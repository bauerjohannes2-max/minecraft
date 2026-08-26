/* ============================================================
   VOXELCRAFT — placing.js
   Right-click places the selected hotbar thing:
   - raycast to adjacent face (the offset cell)
   - blocked if it intersects any entity/player AABB
   - plants need dirt/grass beneath; cactus needs sand
   ============================================================ */

import * as THREE from 'three';
import { B, BLOCK_IDS } from '../config.js';
import { raycastVoxel } from './raycast.js';

const PLANT_BLOCKS = new Set([B.FLOWER, B.TALLGRASS]);
const GROUND_OK    = new Set([B.GRASS, B.DIRT, B.SNOW]);
const CACTUS_GROUND= new Set([B.SAND]);

export class PlacingSystem {
  constructor(world, getEntitiesCB) {
    this.world = world;
    this.getEntities = getEntitiesCB;
    this.cooldown = 0;
    this.onPlaced = null;
  }

  update(dt, player, camera, controls, heldThing) {
    this.cooldown -= dt;
    if (!controls.useHeld || controls.uiOpen || !controls.locked) return;
    if (this.cooldown > 0) return;

    if (heldThing >= 100) {
      return;
    }
    if (heldThing === B.AIR || heldThing === undefined) return;

    this.cooldown = 0.22;

    const eye = player.getEyePosition(new THREE.Vector3());
    const fwd = camera.getForward(new THREE.Vector3());
    const hit = raycastVoxel(this.world, eye, fwd, 5);
    if (!hit.hit) return;

    const px = hit.x + hit.face[0];
    const py = hit.y + hit.face[1];
    const pz = hit.z + hit.face[2];

    if (py < 1) return;

    const cur = this.world.getBlock(px, py, pz);
    if (cur !== B.AIR && cur !== B.WATER && !PLANT_BLOCKS.has(cur)) return;

    // rules
    if (PLANT_BLOCKS.has(heldThing)) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (!GROUND_OK.has(below)) return;
    }
    if (heldThing === B.CACTUS) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (!CACTUS_GROUND.has(below) && below !== B.CACTUS) return;
    }

    // entity overlap check
    const ents = this.getEntities().map(e => ({
      x: e.pos.x, y: e.pos.y, z: e.pos.z,
      w: e.W ?? e.w ?? 0.3, h: e.H ?? e.h ?? 1.8,
    }));
    for (const e of ents) {
      if (Math.abs(px + 0.5 - e.x) < e.w + 0.5 &&
          Math.abs(pz + 0.5 - e.z) < e.w + 0.5 &&
          py + 1 > e.y && py < e.y + e.h) return;
    }

    this.lastType = heldThing;
    this.lastPos = { x: px, y: py, z: pz };
    this.world.setBlock(px, py, pz, heldThing);
    this.onPlaced?.(px, py, pz, heldThing);
  }
}
