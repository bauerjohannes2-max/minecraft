/* ============================================================
   VOXELCRAFT — player.js
   Physics controller: AABB collision resolution (axis-separated),
   gravity, jumping, sprint/sneak/swim movement, fall damage,
   sneaking edge guard, and creative-style fly toggle.
   Position = FEET center of the player.
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B } from '../config.js';

export class Player {
  constructor(world) {
    this.world = world;

    this.pos    = new THREE.Vector3(0, 40, 0);   // feet position
    this.vel    = new THREE.Vector3();
    this.onGround = false;
    this.flying   = false;
    this.inWater  = false;

    // survival stats (used from Part 14+)
    this.health = CONFIG.MAX_HEALTH;
    this.hunger = CONFIG.MAX_HUNGER;
    this.fallStartY = null;          // where current fall began

    // events main.js can hook:
    this.onLand = null;              // (impactSpeed)
    this.onStep = null;              // () footstep
    this.onDamaged = null;

    // internal
    this._stepDistance = 0;
    this.wasOnGround = true;

    const W = CONFIG.PLAYER_HALF_WIDTH, H = CONFIG.PLAYER_HEIGHT;
    this.W = W;
    this.H = H;
  }

  // ============================================================
  // COLLISION
  // AABB of the player at position p: [p.x-W, p.x+W] x [p.y, p.y+H] x [p.z-W, p.z+W]
  // Returns true if any world block overlaps that box.
  // ============================================================
  collides(p) {
    const { W, H } = this;
    const minX = Math.floor(p.x - W), maxX = Math.floor(p.x + W);
    const minY = Math.floor(p.y),     maxY = Math.floor(p.y + H - 0.001);
    const minZ = Math.floor(p.z - W), maxZ = Math.floor(p.z + W);

    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++) {
          const t = this.world.getBlock(x, y, z);
          if (t === B.AIR || t === B.WATER || t === B.FLOWER ||
              t === B.TALLGRASS || t === B.TORCH) continue;
          return true;
        }
    return false;
  }

  // move along ONE axis, stopping cleanly against blocks.
  // returns amount actually moved
  moveAxis(axis, amount) {
    if (amount === 0) return 0;
    const step = Math.sign(amount) * Math.min(Math.abs(amount), 0.45); // sub-steps prevent tunneling
    let moved = 0;
    while (Math.abs(moved) < Math.abs(amount)) {
      const remaining = amount - moved;
      const d = Math.abs(remaining) > Math.abs(step) ? step : remaining;
      const test = this.pos.clone();
      test[axis] += d;
      if (this.collides(test)) break;      // blocked → stop on this axis
      this.pos[axis] += d;
      moved += d;
      if (d === 0) break;
    }
    return moved;
  }

  // block at eye/feet is water? (checks torso center)
  checkWater() {
    const x = Math.floor(this.pos.x),
          z = Math.floor(this.pos.z);
    const feet = this.world.getBlock(x, Math.floor(this.pos.y + 0.2), z);
    const torso = this.world.getBlock(x, Math.floor(this.pos.y + 0.9), z);
    this.inWater = feet === B.WATER || torso === B.WATER;
    return this.inWater;
  }

  // ============================================================
  // MAIN UPDATE — call once per frame
  // controls: the Controls instance; dt: delta seconds
  // ============================================================
  update(dt, controls, cameraYaw) {
    const water = this.checkWater();

    // If swimming, SwimSystem already updated velocities
    if (this.inWater) {
      this.moveAxis('x', this.vel.x * dt);
      this.moveAxis('y', this.vel.y * dt);
      this.moveAxis('z', this.vel.z * dt);
      return;
    }

    // ---------------- desired horizontal velocity ----------------
    this._wish ??= new THREE.Vector3();
    const wish = controls.getMoveVector(this._wish);

    let speed;
    if (this.flying)                 speed = CONFIG.PLAYER_SPRINT_SPEED * 1.8;
    else if (controls.isSneaking())  speed = CONFIG.PLAYER_SNEAK_SPEED;
    else if (controls.isSprinting()) speed = CONFIG.PLAYER_SPRINT_SPEED;
    else                             speed = CONFIG.PLAYER_WALK_SPEED;

    // smooth acceleration toward wish vector
    const accel = controls.accel(this.onGround || this.flying);
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    // ---------------- vertical motion ----------------
    if (this.flying) {
      this.vel.y = 0;
      if (controls.isJumping())        this.vel.y = 9;
      else if (controls.isSneaking())  this.vel.y = -9;
    } else {
      this.vel.y -= CONFIG.GRAVITY * dt;
      if (this.vel.y < -CONFIG.MAX_FALL_SPEED) this.vel.y = -CONFIG.MAX_FALL_SPEED;

      // jump with buffer + coyote time
      if (controls.wantsJump() && (this.onGround || (this._coyote ?? 0) > 0)) {
        this.vel.y = CONFIG.PLAYER_JUMP_VELOCITY;
        this.onGround = false;
        this._coyote = 0;
        controls.consumeJump();
      }
    }

    if (this.onGround) this._coyote = 0.10;
    else this._coyote = Math.max(0, (this._coyote ?? 0) - dt);

    // ---------------- sneak edge guard ----------------
    // If sneaking on ground, don't walk off edges.
    if (controls.isSneaking() && this.onGround && !this.flying && !water) {
      const probe = this.pos.clone();
      probe.y -= 0.6;
      // would-be next X/Z positions with no support?
      const testX = this.pos.clone(); testX.x += this.vel.x * dt; testX.y = probe.y;
      const testZ = this.pos.clone(); testZ.z += this.vel.z * dt; testZ.y = probe.y;
      if (!this.collidesBoxSupported(testX)) this.vel.x = 0;
      if (!this.collidesBoxSupported(testZ)) this.vel.z = 0;
    }

    // ---------------- track fall start ----------------
    if (!this.onGround && !water && !this.flying) {
      if (this.fallStartY === null) this.fallStartY = this.pos.y;
      else this.fallStartY = Math.max(this.fallStartY, this.pos.y); // going up resets peak
    }

    // ---------------- integrate & collide axis-by-axis ----------------
    this.wasOnGround = this.onGround;
    this.onGround = false;

    const mx = this.moveAxis('x', this.vel.x * dt);
    const mz = this.moveAxis('z', this.vel.z * dt);
    const my = this.moveAxis('y', this.vel.y * dt);

    if (my !== this.vel.y * dt) {                 // vertical hit
      if (this.vel.y < 0) {
        this.onGround = true;
        // ---- landing ----
        if (!this.wasOnGround && this.fallStartY !== null) {
          const fallen = this.fallStartY - this.pos.y;
          if (fallen > CONFIG.FALL_DAMAGE_THRESHOLD) {
            this.onLand?.(fallen);                // hunger/combat system applies damage
          }
          if (fallen > 0.5) this.onLand?.(0);      // soft land event (sound)
        }
        this.fallStartY = null;
      }
      this.vel.y = 0;
    }
    if (mx !== this.vel.x * dt) this.vel.x = 0;
    if (mz !== this.vel.z * dt) this.vel.z = 0;

    // standing still on ground also counts as grounded (important after landing frame)
    if (!this.onGround && !this.flying && !water && this.vel.y <= 0) {
      if (this.groundedProbe()) {
        this.onGround = true;
        this.fallStartY = null;
        this.vel.y = 0;
      }
    }

    // ---------------- footsteps ----------------
    if (this.onGround) {
      this._stepDistance += Math.hypot(mx, mz);
      if (this._stepDistance > 2.2) {            // blocks per footstep sound
        this._stepDistance = 0;
        this.onStep?.();
      }
    }

    // keep player inside loaded-world safety net (shouldn't happen, but…)
    if (this.pos.y < -10) {                      // fell through the world somehow
      this.pos.y = 60;
      this.vel.set(0, 0, 0);
    }
  }

  // is there solid ground within 0.6 below this box position?
  groundedProbe(p) {
    const test = (p ?? this.pos).clone();
    test.y -= 0.6;
    const { W } = this;
    const x = Math.floor(test.x - W), xe = Math.floor(test.x + W);
    const z = Math.floor(test.z - W), ze = Math.floor(test.z + W);
    const y = Math.floor(this.pos.y - 0.05);
    for (let bx = x; bx <= xe; bx++)
      for (let bz = z; bz <= ze; bz++) {
        const t = this.world.getBlock(bx, y, bz);
        if (t !== B.AIR && t !== B.WATER && t !== B.FLOWER &&
            t !== B.TALLGRASS && t !== B.TORCH) return true;
      }
    return false;
  }

  // helper used by edge-guard: does this box have ground anywhere below it?
  collidesBoxSupported(p) {
    const savedPos = this.pos, savedH = this.H;
    const test = p.clone(); test.y -= 0.5;
    this.H = 0.2;                                 // thin slab
    const hit = this.collides(test);
    this.H = savedH;
    this.pos.copy(savedPos);
    return hit;
  }

  // ---------------- external helpers ----------------

  getEyePosition(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + CONFIG.PLAYER_EYE_HEIGHT, this.pos.z);
  }

  teleport(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.fallStartY = null;
  }

  // find a safe Y to stand at column (x,z): scan from top
  static findSpawnY(world, x, z) {
    for (let y = CONFIG.WORLD_HEIGHT - 2; y > 0; y--) {
      const t = world.getBlock(Math.floor(x), y, Math.floor(z));
      if (t !== B.AIR && t !== B.WATER) {
        // make sure there's headroom
        if (world.getBlock(Math.floor(x), y+1, Math.floor(z)) === B.AIR &&
            world.getBlock(Math.floor(x), y+2, Math.floor(z)) === B.AIR) {
          return y + 1;
        }
      }
    }
    return CONFIG.SEA_LEVEL + 2;
  }

  damage(n) {
    this.health = Math.max(0, this.health - n);
    this.onDamaged?.(n);
  }

  heal(n) {
    this.health = Math.min(CONFIG.MAX_HEALTH, this.health + n);
  }
}
