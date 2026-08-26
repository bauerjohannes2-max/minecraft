/* ============================================================
   VOXELCRAFT — swimming.js
   Water body state machine for the player:
   - EYES_IN vs BODY_IN water detect (different thresholds!)
   - replaces gravity-with-glide hack: full 3-axis velocity control
   - head-above-surface bobbing when treading
   - AIR meter: 10s underwater, then 1 dmg / sec; regen fast in air
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B } from '../config.js';

export class SwimSystem {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.inWater = false;
    this.headUnder = false;
    this.air = 10;
    this.maxAir = 10;
    this._drownTick = 0;

    const layer = document.getElementById('ui-layer') || document.body;
    this.overlay = document.createElement('div');
    this.overlay.id = 'water-overlay';
    layer.appendChild(this.overlay);

    this.bubblesEl = document.createElement('div');
    this.bubblesEl.id = 'bubbles';
    layer.appendChild(this.bubblesEl);
    this._bubbleCells = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.textContent = '🫧';
      s.style.cssText = 'font-size:16px;filter:drop-shadow(0 0 3px #06c);transition:opacity 0.2s;';
      this.bubblesEl.appendChild(s);
      this._bubbleCells.push(s);
    }
    this.bubblesEl.style.display = 'none';
  }

  update(dt, controls) {
    const p = this.player;

    // sampling
    const eyeY = p.pos.y + CONFIG.PLAYER_EYE_HEIGHT;
    this.headUnder =
      this.world.getBlock(Math.floor(p.pos.x), Math.floor(eyeY),
                          Math.floor(p.pos.z)) === B.WATER;
    this.inWater = this.headUnder ||
      this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.2),
                          Math.floor(p.pos.z)) === B.WATER;

    if (!this.inWater) {
      this.air = Math.min(this.maxAir, this.air + dt * 3);
      this._setOverlay(false);
      this.bubblesEl.style.display = 'none';
      return;
    }

    // SWIM MOVEMENT: damped + omnidirectional
    p.vel.y -= CONFIG.GRAVITY * dt * 0.25;

    const DRAG = Math.min(1, dt * 3.2);
    p.vel.x *= 1 - DRAG;
    p.vel.y *= 1 - DRAG * 0.7;
    p.vel.z *= 1 - DRAG;

    const wish = controls.getMoveVector(p._swimWish ??= new THREE.Vector3());
    const SWIM_SPEED = 3.2;
    p.vel.x += (wish.x * SWIM_SPEED - p.vel.x) * Math.min(1, 8 * dt);
    p.vel.z += (wish.z * SWIM_SPEED - p.vel.z) * Math.min(1, 8 * dt);

    if (controls.wantsJump?.() || (controls.locked && controls.keys.has('Space'))) {
      const above = this.world.getBlock(
        Math.floor(p.pos.x), Math.floor(eyeY + 0.4), Math.floor(p.pos.z));
      if (above === B.WATER) {
        p.vel.y += 14 * dt;
        controls.consumeJump?.();
      } else {
        p.vel.y = Math.max(p.vel.y, 1.6);
      }
    }
    if (controls.sneaking) p.vel.y -= 10 * dt;

    p.vel.y = Math.max(p.vel.y, -3);

    // drowning
    if (this.headUnder) {
      this.air -= dt;
      if (this.air <= 0) {
        this.air = 0;
        this._drownTick += dt;
        if (this._drownTick >= 1) {
          this._drownTick = 0;
          p.damage(2);
        }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 3);
      this._drownTick = 0;
    }

    this._setOverlay(this.headUnder);
    this.bubblesEl.style.display = this.headUnder ? 'flex' : 'none';
    const filled = Math.ceil((this.air / this.maxAir) * 10);
    this._bubbleCells.forEach((s, i) => s.style.opacity = i < filled ? '1' : '0.2');
  }

  _setOverlay(on) {
    this.overlay.classList.toggle('active', on);
  }

  get fogModifier() {
    return this.headUnder ? { color: 0x184488, near: 0, far: 24 } : null;
  }
}
