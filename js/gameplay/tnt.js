/* ============================================================
   VOXELCRAFT — tnt.js
   - Right-click TNT with torch → ignites
   - Ignited block blinks for 3s then BOOM
   - Spherical crater removal, chains nearby TNT
   - Throws debris entities with velocity & gravity bounce
   - Damages player & mobs with distance falloff & knockback
   ============================================================ */

import * as THREE from 'three';
import { B, BLOCK_DROPS } from '../config.js';
import { G } from '../main.js';

const FUSE = 3.0;
const RADIUS = 4;

export class TNTSystem {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.lit = [];
    this.debris = [];
  }

  ignite(x, y, z) {
    if (this.lit.some(l => l.x === x && l.y === y && l.z === z)) return;
    this.world.setBlock(x, y, z, B.AIR);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.98, 0.98),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    m.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(m);
    this.lit.push({ x, y, z, fuse: FUSE, mesh: m });
  }

  tryInteract(hitBlock, heldThing) {
    if (!hitBlock || !hitBlock.hit || hitBlock.block !== B.TNT) return false;
    if (heldThing === B.TORCH) {
      this.ignite(hitBlock.x, hitBlock.y, hitBlock.z);
      return true;
    }
    return false;
  }

  update(dt) {
    // fuses
    for (let i = this.lit.length - 1; i >= 0; i--) {
      const l = this.lit[i];
      l.fuse -= dt;
      const blink = Math.sin(l.fuse * 24) > 0 ? 0xffffff : 0xcc2222;
      l.mesh.material.color.setHex(blink);

      if (l.fuse <= 0) {
        this.explode(l.x, l.y, l.z);
        this.scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        l.mesh.material.dispose();
        this.lit.splice(i, 1);
      }
    }

    // debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= 22 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt * 6;
      d.mesh.rotation.z += dt * 4;

      const p = d.mesh.position;
      const belowBlock = this.world.getBlock(
        Math.floor(p.x), Math.floor(p.y - 0.15), Math.floor(p.z)
      );

      if (belowBlock !== B.AIR && belowBlock !== B.WATER && d.vel.y < 0) {
        p.y = Math.floor(p.y - 0.15) + 1.15;
        d.vel.y *= -0.35;
        d.vel.x *= 0.7;
        d.vel.z *= 0.7;
      }

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.debris.splice(i, 1);
      }
    }
  }

  explode(cx, cy, cz) {
    G.hud?.shakeCamera?.(1.2);

    const r = RADIUS;
    const destroyed = [];

    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let z = cz - r; z <= cz + r; z++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
          if (d2 > r * r * (0.8 + Math.random() * 0.4)) continue;

          const t = this.world.getBlock(x, y, z);
          if (t === B.AIR || t === B.BEDROCK) continue;

          // chain reaction
          if (t === B.TNT) {
            destroyed.push([x, y, z, t]);
            this.ignite(x, y, z);
            continue;
          }

          this.world.setBlock(x, y, z, B.AIR);
          destroyed.push([x, y, z, t]);
        }
      }
    }

    // containers removed
    G.containers?.onBlockRemoved(cx, cy, cz);

    // debris
    for (let i = 0; i < Math.min(destroyed.length, 50); i++) {
      const [x, y, z, t] = destroyed[(Math.random() * destroyed.length) | 0];
      const col = paletteColorFor(t);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.24),
        new THREE.MeshLambertMaterial({ color: col })
      );
      m.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.scene.add(m);

      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 2
      ).normalize();

      this.debris.push({
        mesh: m,
        life: 2.5 + Math.random() * 2,
        vel: dir.multiplyScalar(7 + Math.random() * 8),
      });
    }

    // damage & knockback
    const blast = (pos, applyFn) => {
      const dx = pos.x - (cx + 0.5);
      const dy = pos.y - (cy + 0.5);
      const dz = pos.z - (cz + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > r * 1.6) return;
      const falloff = 1 - dist / (r * 1.6);
      applyFn(Math.ceil(falloff * 16), dist, { x: cx + 0.5, z: cz + 0.5 });
    };

    if (G.player) {
      blast(G.player.pos, (dmg, dist, from) => {
        G.player.damage(dmg);
        const kx = G.player.pos.x - from.x, kz = G.player.pos.z - from.z;
        const k = Math.hypot(kx, kz) || 1;
        const power = (1 - dist / (r * 1.6)) * 20;
        G.player.vel.x += (kx / k) * power;
        G.player.vel.z += (kz / k) * power;
        G.player.vel.y = Math.max(G.player.vel.y, power * 0.7);
      });
    }

    if (G.mobs) {
      for (const m of G.mobs.mobs) {
        if (m.dead) continue;
        blast(m.pos, (dmg, _d, from) => m.hurt(dmg, from));
      }
    }

    // drops
    for (const [x, y, z, t] of destroyed) {
      if (Math.random() < 0.35) {
        const drop = BLOCK_DROPS[t] ?? t;
        const thing = typeof drop === 'function' ? drop() : drop;
        if (thing != null && thing !== B.AIR) {
          G.drops?.spawn(thing, 1, x + 0.5, y + 0.5, z + 0.5);
        }
      }
    }
  }
}

function paletteColorFor(t) {
  if (t === B.DIRT || t === B.GRASS) return 0x79553a;
  if (t === B.STONE || t === B.COBBLE) return 0x888888;
  if (t === B.SAND) return 0xd2c286;
  if (t === B.WOOD_LOG || t === B.PLANKS) return 0x9c6e3b;
  if (t === B.LEAVES) return 0x477e35;
  if (t === B.COAL_ORE) return 0x333333;
  if (t === B.IRON_ORE) return 0xd8af93;
  if (t === B.TNT) return 0xcc2222;
  return 0x888888;
}
