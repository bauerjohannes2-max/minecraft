/* ============================================================
   VOXELCRAFT — raycast.js
   Voxel traversal (Amanatides & Woo). Returns the first
   non-air block hit plus its face normal → used for mining,
   placing, torches on walls, mob line-of-sight later.
   ============================================================ */

import * as THREE from 'three';
import { B } from '../config.js';

export function raycastVoxel(world, origin, dir, maxDist = 5, includeWater = false) {
  let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);

  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX = stepX > 0 ? (x + 1 - origin.x) / dir.x :
              stepX < 0 ? (x     - origin.x) / dir.x : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) / dir.y :
              stepY < 0 ? (y     - origin.y) / dir.y : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) / dir.z :
              stepZ < 0 ? (z     - origin.z) / dir.z : Infinity;

  let face = [0, 0, 0];
  let t = 0;

  while (t <= maxDist) {
    const bt = world.getBlock(x, y, z);
    if (bt !== B.AIR && (includeWater || bt !== B.WATER)) {
      return {
        hit: true,
        x, y, z,
        block: bt,
        face: [face[0], face[1], face[2]],
        dist: t,
      };
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ)      { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
    else if (tMaxY < tMaxZ)                  { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
    else                                     { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
  }
  return { hit: false };
}
