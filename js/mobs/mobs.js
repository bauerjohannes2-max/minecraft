/* ============================================================
   VOXELCRAFT — mobs.js
   Spawning/despawning near player, per-frame update,
   daytime zombie burning, syncs model transforms.
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B } from '../config.js';
import { Mob } from './mob.js';
import { Pig } from './pig.js';
import { Zombie } from './zombie.js';
import { buildPigModel, buildZombieModel } from './models.js';

const MAX_MOBS = 14;
const DESPAWN_DIST = 60;

export class MobManager {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.mobs = [];
    this.spawnTimer = 3;
    this.isNight = () => false;
    this.attackPlayer = null;
    this.getDropsSpawnCB = null;
  }

  spawn(type, x, y, z) {
    if (this.mobs.length >= MAX_MOBS) return null;
    const m = type === 'pig' ? new Pig(this.world) : new Zombie(this.world);
    m.pos.set(x, y, z);

    const model = type === 'pig' ? buildPigModel() : buildZombieModel();
    m.modelGroup = model.group;
    m.legs = model.legs;
    m.animPhase = Math.random() * 10;
    this.scene.add(model.group);

    if (type === 'pig') {
      m.onDeath = () => this.loot(m, 112 /* porkchop */, 1 + (Math.random() < 0.5 ? 1 : 0));
    } else {
      m.onDeath = () => {
        if (Math.random() < 0.6) this.loot(m, 112, 1);
      };
    }
    this.mobs.push(m);
    return m;
  }

  loot(m, thing, qty) {
    this.getDropsSpawnCB?.(thing, qty, m.pos.x, m.pos.y + 0.5, m.pos.z);
  }

  tryNaturalSpawn(playerPos) {
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 20;
      const x = Math.floor(playerPos.x + Math.cos(a) * r);
      const z = Math.floor(playerPos.z + Math.sin(a) * r);

      let y = -1;
      for (let yy = CONFIG.WORLD_HEIGHT - 1; yy > 2; yy--) {
        const t = this.world.getBlock(x, yy, z);
        if (t !== B.AIR && t !== B.WATER) { y = yy + 1; break; }
      }
      if (y < 0 || y < CONFIG.SEA_LEVEL) continue;

      const night = this.isNight();
      const roll = Math.random();
      if (night ? roll < 0.6 : roll < 0.15)      this.spawn('zombie', x + 0.5, y, z + 0.5);
      else                                       this.spawn('pig',    x + 0.5, y, z + 0.5);
      return;
    }
  }

  update(dt, player) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.isNight() ? 4 : 8;
      if (this.mobs.length < MAX_MOBS) this.tryNaturalSpawn(player.pos);
    }

    const dayBurn = !this.isNight();

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];

      const dp = m.pos.distanceTo(player.pos);
      if (dp > DESPAWN_DIST || m.pos.y < -10) {
        this._remove(i, m);
        continue;
      }

      // ---- death animation ----
      if (m.dead) {
        m.deathTimer -= dt;
        m.modelGroup.rotation.z = THREE.MathUtils.lerp(
          m.modelGroup.rotation.z, Math.PI / 2, dt * 6);
        m.modelGroup.position.copy(m.pos).add(new THREE.Vector3(0, 0.2, 0));
        m.hurtFlash = 0.2;
        this._flash(m, Math.sin(m.deathTimer * 30) > 0);
        if (m.deathTimer <= 0) this._remove(i, m);
        continue;
      }

      // ---- zombies burn in daylight ----
      if (m instanceof Zombie && dayBurn) {
        if (Math.random() < dt * 0.2) {
          m.hurt(1, null);
          if (m.dead) continue;
        }
      }

      // ---- AI + physics ----
      m.think(dt, {
        player,
        attackPlayer: this.attackPlayer,
        threatPos: m.threatPos ?? player.pos,
      });

      if (!m.dead) m.physics(dt);

      // ---- sync visuals ----
      m.animPhase += Math.hypot(m.vel.x, m.vel.z) * dt * 5;
      m.modelGroup.position.copy(m.pos);
      m.modelGroup.rotation.y = m.yaw;
      const swing = Math.sin(m.animPhase * 2.2) * 0.55 *
                    Math.min(1, Math.hypot(m.vel.x, m.vel.z));
      m.legs.forEach((leg, li) => leg.rotation.x = swing * (li % 2 ? -1 : 1));

      this._flash(m, m.hurtFlash > 0);
      if (m.hurtFlash > 0) m.hurtFlash -= dt;
    }
  }

  _flash(m, on) {
    m.modelGroup.traverse(o => {
      if (o.material) o.material.emissive?.setHex(on ? 0x991111 : 0x000000);
    });
  }

  _remove(i, m) {
    this.scene.remove(m.modelGroup);
    m.modelGroup.traverse(o => { o.geometry?.dispose(); });
    this.mobs.splice(i, 1);
  }

  allEntities() {
    return this.mobs.filter(m => !m.dead);
  }

  clear() {
    while (this.mobs.length) this._remove(0, this.mobs[0]);
  }
}
