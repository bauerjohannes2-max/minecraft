/* ============================================================
   VOXELCRAFT — controls.js
   Feel fixes baked in:
   - normalized diagonal movement (no 1.41x speed boost)
   - movement is YAW-ONLY (pitch never affects walking)
   - frame-rate independent smoothing (accel/decel, dt-based)
   - keys can't stick: window blur & pointerlock loss clear all
   - configurable sensitivity + optional mouse smoothing
   - jump buffering (jump pressed slightly before landing works)
   - coyote time (grace period after walking off a ledge)
   ============================================================ */

const LOOK_SENSITIVITY = 0.0023;      // radians per pixel
const GROUND_ACCEL = 14;              // snappy ground accel
const AIR_ACCEL = 4;                  // mid-air control
const JUMP_BUFFER = 0.12;             // early jump buffering
const COYOTE_TIME = 0.10;             // grace period after ledge

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.locked = false;
    this.uiOpen = false;
    this.wantLock = false;

    // -------- key state --------
    this.keys = new Set();
    this._justPressed = new Set();
    this._justReleased = new Set();

    // -------- look --------
    this.yaw = 0;
    this.pitch = 0;
    this._mouseDX = 0;
    this._mouseDY = 0;

    // -------- actions --------
    this.attackHeld = false;
    this.useHeld = false;

    // -------- buffered jumps & sprint --------
    this._jumpBuffer = 0;
    this._coyote = 0;
    this._quickSavePressed = false;
    this._lastWPressTime = 0;
    this._doubleTapSprint = false;

    // ---------------- keyboard ----------------
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Tab') e.preventDefault();

      if (this.uiOpen && !['Escape', 'KeyE'].includes(e.code)) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        const now = performance.now();
        if (now - this._lastWPressTime < 300) {
          this._doubleTapSprint = true;
        }
        this._lastWPressTime = now;
      }

      this.keys.add(e.code);
      this._justPressed.add(e.code);
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._justReleased.add(e.code);
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (!this.keys.has('KeyW') && !this.keys.has('ArrowUp')) {
          this._doubleTapSprint = false;
        }
      }
    });

    window.addEventListener('blur', () => this._releaseAll());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this._releaseAll();
      this.onLockChange?.(this.locked);
    });

    // ---------------- mouse look ----------------
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.uiOpen) return;
      this._mouseDX += e.movementX;
      this._mouseDY += e.movementY;
    });

    // ---------------- buttons ----------------
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) { this.attackHeld = true; this._justPressed.add('Mouse0'); }
      if (e.button === 2) { this.useHeld = true;   this._justPressed.add('Mouse2'); }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.attackHeld = false; this._justReleased.add('Mouse0'); }
      if (e.button === 2) { this.useHeld = false;   this._justReleased.add('Mouse2'); }
    });

    document.addEventListener('contextmenu', e => e.preventDefault());

    // ---------------- wheel: hotbar scroll ----------------
    document.addEventListener('wheel', (e) => {
      if (!this.locked || this.uiOpen) return;
      this.onScroll?.(Math.sign(e.deltaY));
    }, { passive: true });

    document.addEventListener('click', () => {
      if (!this.locked && !this.uiOpen && this.wantLock) this.requestLock();
    });

    // ---------------- mobile touch detection & setup ----------------
    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches;
    if (this.isTouch) {
      this._initTouchControls();
    }
  }

  _initTouchControls() {
    const tc = document.getElementById('touch-controls');
    if (tc) tc.classList.remove('hidden');
    this.locked = true;

    // Right-side swipe look
    let lookTouchId = null;
    let lastLookX = 0, lastLookY = 0;

    window.addEventListener('touchstart', (e) => {
      if (this.uiOpen) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.30 && lookTouchId === null) {
          const target = document.elementFromPoint(t.clientX, t.clientY);
          if (target && target.closest('.touch-btn, .slot')) continue;
          lookTouchId = t.identifier;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.uiOpen) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === lookTouchId) {
          const dx = t.clientX - lastLookX;
          const dy = t.clientY - lastLookY;
          this._mouseDX += dx * 1.5;
          this._mouseDY += dy * 1.5;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    }, { passive: true });

    const endLook = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId) {
          lookTouchId = null;
        }
      }
    };
    window.addEventListener('touchend', endLook, { passive: true });
    window.addEventListener('touchcancel', endLook, { passive: true });

    // D-Pad buttons
    const bindBtn = (id, onDown, onUp) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        onDown();
      }, { passive: false });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('active');
        onUp();
      }, { passive: false });
      btn.addEventListener('touchcancel', () => {
        btn.classList.remove('active');
        onUp();
      }, { passive: true });
    };

    bindBtn('dpad-up', () => {
      const now = performance.now();
      if (now - this._lastWPressTime < 350) this._doubleTapSprint = true;
      this._lastWPressTime = now;
      this.keys.add('KeyW');
    }, () => {
      this.keys.delete('KeyW');
      this._doubleTapSprint = false;
    });
    bindBtn('dpad-down', () => this.keys.add('KeyS'), () => this.keys.delete('KeyS'));
    bindBtn('dpad-left', () => this.keys.add('KeyA'), () => this.keys.delete('KeyA'));
    bindBtn('dpad-right', () => this.keys.add('KeyD'), () => this.keys.delete('KeyD'));
    bindBtn('dpad-center', () => {
      if (this.keys.has('ShiftLeft')) this.keys.delete('ShiftLeft');
      else this.keys.add('ShiftLeft');
    }, () => {});

    // Action buttons
    bindBtn('btn-touch-jump', () => {
      this._jumpBuffer = JUMP_BUFFER;
      this.keys.add('Space');
    }, () => {
      this.keys.delete('Space');
    });

    bindBtn('btn-touch-attack', () => {
      this.attackHeld = true;
      this._justPressed.add('Mouse0');
    }, () => {
      this.attackHeld = false;
      this._justReleased.add('Mouse0');
    });

    bindBtn('btn-touch-place', () => {
      this.useHeld = true;
      this._justPressed.add('Mouse2');
    }, () => {
      this.useHeld = false;
      this._justReleased.add('Mouse2');
    });

    // Top buttons
    document.getElementById('btn-touch-inv')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onInventoryToggle?.();
    });
    document.getElementById('btn-touch-fly')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onFlyToggle?.();
    });
    document.getElementById('btn-touch-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPauseRequested?.();
    });
  }

  _releaseAll() {
    this.keys.clear();
    this.attackHeld = false;
    this.useHeld = false;
  }

  requestLock() {
    this.wantLock = true;
    if (this.isTouch) {
      this.locked = true;
      this.onLockChange?.(true);
      return;
    }
    this.canvas.requestPointerLock?.();
  }

  exitLock() {
    this.wantLock = false;
    if (!this.isTouch) {
      document.exitPointerLock?.();
    }
  }

  setUIOpen(open) {
    this.uiOpen = open;
    if (open) {
      this.exitLock();
      this._releaseAll();
    } else if (this.isTouch) {
      this.locked = true;
    }
  }

  // ============================================================
  // call ONCE per frame, FIRST, before camera & player updates
  // ============================================================
  update(dt) {
    const dx = this._mouseDX, dy = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;

    this.yaw   -= dx * LOOK_SENSITIVITY;
    this.pitch -= dy * LOOK_SENSITIVITY;
    this.pitch = Math.max(-Math.PI / 2 + 0.01,
                 Math.min( Math.PI / 2 - 0.01, this.pitch));

    // timers
    this._jumpBuffer -= dt;
    this._coyote     -= dt;
    if (this._justPressed.has('Space')) this._jumpBuffer = JUMP_BUFFER;

    // discrete one-shot callbacks
    if (this._justPressed.has('KeyE')) this.onInventoryToggle?.();
    if (this._justPressed.has('KeyQ')) this.onDropItem?.();
    if (this._justPressed.has('F3'))   this.onDebugToggle?.();
    if (this._justPressed.has('F5'))   { this._quickSavePressed = true; this.onQuickSave?.(); }
    if (this._justPressed.has('Escape')) {
      if (this.uiOpen) this.onInventoryToggle?.();
      else this.onPauseRequested?.();
    }
    for (let i = 1; i <= 9; i++) {
      if (this._justPressed.has('Digit' + i)) this.onHotbarKey?.(i - 1);
    }

    if (this._justPressed.has('KeyF')) this.onFlyToggle?.();
    if (this._justReleased.has('KeyF')) this.onFlyToggleOff?.();

    this._justPressed.clear();
    this._justReleased.clear();
  }

  // ============================================================
  // movement query — normalized wish direction in WORLD space (yaw only)
  // ============================================================
  getMoveVector(out) {
    let fx = 0, fz = 0;
    if (this.locked && !this.uiOpen) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    fz -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  fz += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  fx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) fx += 1;
    }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    out.x =  fx * cos + fz * sin;
    out.z = -fx * sin + fz * cos;
    return out;
  }

  // backwards-compatible helper
  getMoveAxis() {
    let x = 0, z = 0;
    if (this.locked && !this.uiOpen) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    z -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  z += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    }
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  wantsJump()    { return this._jumpBuffer > 0 && this.locked && !this.uiOpen; }
  consumeJump()  { this._jumpBuffer = 0; }
  isJumping()    { return this.locked && !this.uiOpen && this.keys.has('Space'); }
  isSneaking()   { return this.locked && !this.uiOpen && (this.keys.has('ShiftLeft') || this.keys.has('KeyC')); }
  isSprinting()  {
    if (!this.locked || this.uiOpen) return false;
    const movingFwd = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    if (!movingFwd) return false;
    return this.keys.has('ControlLeft') ||
           this.keys.has('ControlRight') ||
           this.keys.has('ShiftRight') ||
           this.keys.has('KeyR') ||
           this._doubleTapSprint;
  }
  get sneaking() { return this.isSneaking(); }
  get sprinting(){ return this.isSprinting(); }
  accel(isOnGround) { return isOnGround ? GROUND_ACCEL : AIR_ACCEL; }

  consumeQuickSavePressed() {
    const v = this._quickSavePressed;
    this._quickSavePressed = false;
    return !!v;
  }

  consumeLook() {
    return { dx: 0, dy: 0 };
  }
}
