/* ============================================================
   VOXELCRAFT — mob.js
   Base entity class:
   - AABB world collision identical in spirit to Player
   - gravity / water buoyancy / step-up of 1 block
   - simple state machine driven by subclass "think()"
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B } from '../config.js';

export class Mob {
  constructor(world, opts = {}) {
    this.world = world;
    this.W = opts.w ?? 0.45;
    this.H = opts.h ?? 1.4;
    this.speed = opts.speed ?? 2;
    this.maxHealth = opts.health ?? 10;
    this.health = this.maxHealth;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.onGround = false;
    this.inWater = false;
    this.dead = false;
    this.removeMe = false;

    // AI timers
    this.thinkTimer = 0;
    this.moveDir = { x: 0, z: 0 };
    this.jumpCooldown = 0;
    this.hurtFlash = 0;
    this.attackCooldown = 0;
    this.fleeTimer = 0;
    this.lastAttackerPos = null;
    this.threatPos = null;

    this.onDeath = null;
    this.onHurt = null;
  }

  collides(p) {
    const { W, H } = this;
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + H - 0.001); y++)
      for (let z = Math.floor(p.z - W); z <= Math.floor(p.z + W); z++)
        for (let x = Math.floor(p.x - W); x <= Math.floor(p.x + W); x++) {
          const t = this.world.getBlock(x, y, z);
          if (t === B.AIR || t === B.WATER || t === B.FLOWER ||
              t === B.TALLGRASS || t === B.TORCH) continue;
          return true;
        }
    return false;
  }

  moveAxis(axis, amount) {
    if (!amount) return 0;
    let moved = 0;
    while (Math.abs(moved) < Math.abs(amount)) {
      const d = Math.sign(amount) * Math.min(Math.abs(amount - moved), 0.4);
      const test = this.pos.clone(); test[axis] += d;
      if (this.collides(test)) break;
      this.pos[axis] += d; moved += d;
    }
    return moved;
  }

  physics(dt) {
    const fx = Math.floor(this.pos.x), fz = Math.floor(this.pos.z);
    this.inWater =
      this.world.getBlock(fx, Math.floor(this.pos.y + 0.3), fz) === B.WATER;

    if (this.inWater) {
      this.vel.y += 9 * dt;
      this.vel.y *= (1 - Math.min(1, dt * 2.5));
      this.vel.x *= (1 - Math.min(1, dt * 1.5));
      this.vel.z *= (1 - Math.min(1, dt * 1.5));
    } else {
      this.vel.y -= CONFIG.GRAVITY * dt;
      if (this.vel.y < -CONFIG.MAX_FALL_SPEED) this.vel.y = -CONFIG.MAX_FALL_SPEED;
    }

    this.onGround = false;
    const my = this.moveAxis('y', this.vel.y * dt);
    if (my !== this.vel.y * dt && this.vel.y < 0) this.onGround = true;
    this.vel.y = my !== this.vel.y * dt ? 0 : this.vel.y;

    const mx = this.moveAxis('x', this.vel.x * dt);
    const mz = this.moveAxis('z', this.vel.z * dt);
    const blockedX = mx !== this.vel.x * dt;
    const blockedZ = mz !== this.vel.z * dt;
    if (blockedX) this.vel.x = 0;
    if (blockedZ) this.vel.z = 0;

    this.jumpCooldown -= dt;
    if ((blockedX || blockedZ) && this.onGround && this.jumpCooldown <= 0 &&
        (Math.abs(this.vel.x) > 0.1 || Math.abs(this.vel.z) > 0.1)) {
      this.vel.y = CONFIG.PLAYER_JUMP_VELOCITY * 0.9;
      this.jumpCooldown = 0.8;
    }
  }

  seek(targetX, targetZ, speed = this.speed) {
    const dx = targetX - this.pos.x, dz = targetZ - this.pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    this.vel.x += (dx/len*speed - this.vel.x) * Math.min(1, 8 * 0.016);
    this.vel.z += (dz/len*speed - this.vel.z) * Math.min(1, 8 * 0.016);
    this.yaw = Math.atan2(-dx, -dz);
  }

  hurt(dmg, knockFrom = null) {
    if (this.dead) return;
    this.health -= dmg;
    this.hurtFlash = 0.35;
    this.lastAttackerPos = knockFrom;
    if (knockFrom) {
      const kx = this.pos.x - knockFrom.x, kz = this.pos.z - knockFrom.z;
      const l = Math.hypot(kx, kz) || 1;
      this.vel.x += kx/l * 7;
      this.vel.z += kz/l * 7;
      this.vel.y = 5;
    }
    this.onHurt?.(knockFrom);
    if (this.health <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.deathTimer = 0.9;
    this.onDeath?.(this);
  }

  think(dt, ctx) {}
}
