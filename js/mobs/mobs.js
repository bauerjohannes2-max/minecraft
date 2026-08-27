/* ============================================================
   VOXELCRAFT — mobs.js
   Spawning/despawning near player, per-frame update,
   daytime zombie burning, syncs model transforms.
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B, ITEMS } from '../config.js';
import { Mob } from './mob.js';
import { Pig } from './pig.js';
import { Sheep, Cow } from './passive.js';
import { Zombie } from './zombie.js';
import { buildPigModel, buildZombieModel, buildSheepModel, buildCowModel } from './models.js';

const MAX_MOBS = 16;
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

    let m, model;
    if (type === 'pig') {
      m = new Pig(this.world);
      model = buildPigModel();
      m.onDeath = () => this.loot(m, ITEMS.raw_porkchop?.id ?? 110, 1 + (Math.random() < 0.5 ? 1 : 0));
    } else if (type === 'sheep') {
      m = new Sheep(this.world);
      model = buildSheepModel();
      m.onDeath = () => {
        this.loot(m, ITEMS.wool?.id ?? 121, 1 + Math.floor(Math.random() * 2));
        if (Math.random() < 0.6) this.loot(m, ITEMS.raw_porkchop?.id ?? 110, 1);
      };
    } else if (type === 'cow') {
      m = new Cow(this.world);
      model = buildCowModel();
      m.onDeath = () => {
        this.loot(m, ITEMS.raw_beef?.id ?? 119, 1 + (Math.random() < 0.5 ? 1 : 0));
        if (Math.random() < 0.7) this.loot(m, ITEMS.leather?.id ?? 122, 1);
      };
    } else {
      m = new Zombie(this.world);
      model = buildZombieModel();
      m.onDeath = () => {
        this.loot(m, ITEMS.rotten_flesh?.id ?? 112, 1);
        if (Math.random() < 0.25) this.loot(m, ITEMS.gunpowder?.id ?? 123, 1);
        if (Math.random() < 0.20) this.loot(m, ITEMS.stringy?.id ?? 143, 1);
      };
    }

    m.pos.set(x, y, z);
    m.modelGroup = model.group;
    m.legs = model.legs;
    m.animPhase = Math.random() * 10;
    this.scene.add(model.group);
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
      if (night) {
        if (Math.random() < 0.65) {
          this.spawn('zombie', x + 0.5, y, z + 0.5);
        } else {
          const fauna = ['pig', 'sheep', 'cow'];
          const chosen = fauna[Math.floor(Math.random() * fauna.length)];
          this.spawn(chosen, x + 0.5, y, z + 0.5);
        }
      } else {
        // Daytime: only peaceful farm animals spawn on surface
        const fauna = ['pig', 'sheep', 'cow'];
        const chosen = fauna[Math.floor(Math.random() * fauna.length)];
        this.spawn(chosen, x + 0.5, y, z + 0.5);
      }
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

      // ---- zombies burn in daylight only when exposed to open sky ----
      if (m instanceof Zombie && dayBurn) {
        const above = this.world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y + 2), Math.floor(m.pos.z));
        if (above === B.AIR || above === B.WATER) {
          if (Math.random() < dt * 0.25) {
            m.hurt(1, null);
            if (m.dead) continue;
          }
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
