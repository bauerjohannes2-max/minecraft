/* ============================================================
   VOXELCRAFT — pig.js — passive: wander, panic when hit
   ============================================================ */
import * as THREE from 'three';
import { Mob } from './mob.js';

export class Pig extends Mob {
  constructor(world) {
    super(world, { w: 0.42, h: 0.9, speed: 1.3, health: 10 });
    this.panicSpeed = 2.6;
  }

  think(dt, ctx) {
    if (this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      const threat = this.threatPos || ctx.threatPos || { x: this.pos.x, z: this.pos.z };
      const dx = this.pos.x - threat.x, dz = this.pos.z - threat.z;
      this.seek(this.pos.x + dx, this.pos.z + dz, this.panicSpeed);
      return;
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 2 + Math.random() * 4;
      if (Math.random() < 0.6)
        this.moveDir = { x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 };
      else this.moveDir = { x: 0, z: 0 };
    }
    if (this.moveDir.x || this.moveDir.z)
      this.seek(this.pos.x + this.moveDir.x * 5, this.pos.z + this.moveDir.z * 5);
    else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
  }

  onHurt(lastAttackerPos) {
    this.fleeTimer = 6;
    if (lastAttackerPos) this.threatPos = { x: lastAttackerPos.x, z: lastAttackerPos.z };
  }
}
