/* ============================================================
   VOXELCRAFT — zombie.js — hostile: chases the player at night
   ============================================================ */
import { Mob } from './mob.js';

const ATTACK_RANGE = 1.6, ATTACK_DMG = 3, ATTACK_PERIOD = 1.0;

export class Zombie extends Mob {
  constructor(world) {
    super(world, { w: 0.35, h: 1.85, speed: 1.9, health: 20 });
    this.burnsInDay = true;
  }

  think(dt, ctx) {
    const target = ctx.player;
    const dist = Math.hypot(
      target.pos.x - this.pos.x,
      target.pos.z - this.pos.z
    );

    if (dist < 24) {
      this.seek(target.pos.x, target.pos.z);
      this.attackCooldown -= dt;
      const dyOK = Math.abs(target.pos.y - this.pos.y) < 2.5;
      if (dist < ATTACK_RANGE && dyOK && this.attackCooldown <= 0) {
        this.attackCooldown = ATTACK_PERIOD;
        ctx.attackPlayer?.(ATTACK_DMG, this.pos);
      }
    } else {
      this.thinkTimer -= dt;
      if (this.thinkTimer <= 0) {
        this.thinkTimer = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2;
        this.moveDir = Math.random() < 0.5
          ? { x: Math.cos(a), z: Math.sin(a) } : { x: 0, z: 0 };
      }
      if (this.moveDir.x || this.moveDir.z)
        this.seek(this.pos.x + this.moveDir.x * 5, this.pos.z + this.moveDir.z * 5, 0.8);
    }
  }
}
