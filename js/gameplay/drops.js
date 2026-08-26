/* ============================================================
   VOXELCRAFT — drops.js
   Floating item entities: mini textured cubes that bob & spin,
   get affected by gravity/collision, and fly toward the player
   when close (pickup magnetism).
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B, BLOCK_IDS, BLOCKS, BLOCK_DROPS, ITEMS, BLOCK_FACE_TILES } from '../config.js';
import { getAtlasTexture, tileUV } from '../graphics/textures.js';

const dropGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

let _dropMat = null;
function dropMaterial() {
  if (!_dropMat) {
    _dropMat = new THREE.MeshLambertMaterial({ map: getAtlasTexture() });
  }
  return _dropMat;
}

function BLOCK_FACE_TILES_SAFE(thingId) {
  if (thingId >= 100) return ['planks','planks','planks'];
  return BLOCK_FACE_TILES[thingId];
}

export class DropSystem {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.drops = [];              // { mesh, thing, count, vel, age, pickupDelay }
    this.onPickup = null;         // (thing, count) => bool consumed? set by inventory
  }

  // what a broken block yields (respects BLOCK_DROPS overrides)
  static dropFor(blockType) {
    const override = BLOCK_DROPS[blockType];
    if (override === undefined) return blockType;
    if (typeof override === 'function') return override();
    if (override === B.AIR) return null;
    return override;
  }

  spawn(thing, count, x, y, z, scatter = true) {
    if (!thing || thing === B.AIR || count <= 0) return;

    const tiles = BLOCK_FACE_TILES_SAFE(thing);
    const geo = dropGeo.clone();
    if (tiles) {
      const [u0, v0, u1, v1] = tileUV(tiles[2]);
      const uvAttr = geo.attributes.uv;
      for (let i = 0; i < uvAttr.count; i += 4) {
        uvAttr.setXY(i + 0, u0, v1);
        uvAttr.setXY(i + 1, u0, v0);
        uvAttr.setXY(i + 2, u1, v1);
        uvAttr.setXY(i + 3, u1, v0);
      }
      uvAttr.needsUpdate = true;
    }

    const mesh = new THREE.Mesh(geo, dropMaterial());
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.drops.push({
      mesh,
      thing,
      count,
      vel: new THREE.Vector3(
        scatter ? (Math.random() - 0.5) * 2.2 : 0,
        scatter ? 2.6 + Math.random() : 1.5,
        scatter ? (Math.random() - 0.5) * 2.2 : 0
      ),
      age: 0,
      pickupDelay: 0.45,
    });
  }

  update(dt, player) {
    const pp = player.pos;

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.pickupDelay -= dt;

      const m = d.mesh;

      // ---------- physics ----------
      d.vel.y -= CONFIG.GRAVITY * 0.55 * dt;
      m.position.x += d.vel.x * dt;
      m.position.y += d.vel.y * dt;
      m.position.z += d.vel.z * dt;

      const under = this.world.getBlock(
        Math.floor(m.position.x), Math.floor(m.position.y - 0.15), Math.floor(m.position.z));
      const onSolid = under !== B.AIR && under !== B.WATER &&
                      (BLOCKS[BLOCK_IDS[under]]?.solid ?? false);
      if (onSolid && d.vel.y < 0) {
        m.position.y = Math.floor(m.position.y - 0.15) + 1.16;
        d.vel.y = 0;
        d.vel.x *= 0.7;
        d.vel.z *= 0.7;
      }

      // water floats it up
      const inWater = this.world.getBlock(
        Math.floor(m.position.x), Math.floor(m.position.y), Math.floor(m.position.z)) === B.WATER;
      if (inWater) d.vel.y = Math.min(d.vel.y + 12 * dt, 1.2);

      // ---------- visuals ----------
      m.rotation.y += dt * 1.8;
      m.position.y += Math.sin(d.age * 3) * dt * 0.15;

      // ---------- pickup ----------
      const dx = pp.x - m.position.x;
      const dy = (pp.y + 0.8) - m.position.y;
      const dz = pp.z - m.position.z;
      const distSq = dx*dx + dy*dy + dz*dz;

      if (d.pickupDelay <= 0 && distSq < 9) {
        const dist = Math.sqrt(distSq) || 0.001;
        const pull = 9 / dist;
        m.position.x += dx * pull * dt;
        m.position.y += dy * pull * dt;
        m.position.z += dz * pull * dt;

        if (dist < 0.6) {
          const consumed = this.onPickup?.(d.thing, d.count);
          if (consumed !== false) {
            this.scene.remove(m);
            m.geometry.dispose();
            this.drops.splice(i, 1);
            continue;
          }
        }
      }

      // despawn after 4 minutes
      if (d.age > 240) {
        this.scene.remove(m);
        m.geometry.dispose();
        this.drops.splice(i, 1);
      }
    }
  }

  clear() {
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
    }
    this.drops = [];
  }
}
