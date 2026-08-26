/* ============================================================
   VOXELCRAFT — lighting.js
   Voxel flood-fill lighting system:
   - Computes per-chunk sunlight & torchlight (0-15)
   - Bounded BFS propagation through transparent/air blocks
   - Provides vertex shading values to mesher
   ============================================================ */

import { CONFIG, B, BLOCKS, BLOCK_IDS } from '../config.js';

const CSIZE = 16;
const WORLD_H = CONFIG.WORLD_HEIGHT;

export function emissiveLevel(t) {
  if (t === B.TORCH) return 14;
  if (t === B.TNT)   return 10;
  return 0;
}

function isOpaque(t) {
  if (t === B.AIR || t === B.WATER) return false;
  if (t >= B.WHEAT0 && t <= B.WHEAT3) return false;
  if (t === B.FLOWER || t === B.TALLGRASS || t === B.TORCH || t === B.GLASS) return false;
  const def = BLOCKS[BLOCK_IDS[t]];
  return def ? !def.transparent : true;
}

export class ChunkLight {
  constructor(chunk) {
    this.chunk = chunk;
    this.data = new Uint8Array(CSIZE * WORLD_H * CSIZE);
  }

  idx(lx, y, lz) {
    return (y * CSIZE + lz) * CSIZE + lx;
  }

  compute() {
    this.data.fill(0);
    const queue = [];
    const c = this.chunk;

    // 1. Sky light baseline (open columns receive daylight)
    for (let lz = 0; lz < CSIZE; lz++) {
      for (let lx = 0; lx < CSIZE; lx++) {
        for (let y = WORLD_H - 1; y >= 0; y--) {
          const t = c.blocks[c.idx(lx, y, lz)];
          if (isOpaque(t) || t === B.WATER) break;
          const i = this.idx(lx, y, lz);
          this.data[i] = 13;
        }
      }
    }

    // 2. Torch & emissive seeds
    for (let y = 0; y < WORLD_H; y++) {
      for (let lz = 0; lz < CSIZE; lz++) {
        for (let lx = 0; lx < CSIZE; lx++) {
          const t = c.blocks[c.idx(lx, y, lz)];
          const e = emissiveLevel(t);
          if (e > 0) {
            const i = this.idx(lx, y, lz);
            this.data[i] = Math.max(this.data[i], e);
            queue.push(lx, y, lz);
          }
        }
      }
    }

    // 3. Fast O(1) pointer-based BFS flood fill
    let qi = 0;
    while (qi < queue.length) {
      const x = queue[qi++];
      const y = queue[qi++];
      const z = queue[qi++];

      const lvl = this.data[this.idx(x, y, z)];
      if (lvl <= 1) continue;

      const DIRS = [
        1, 0, 0,
        -1, 0, 0,
        0, 1, 0,
        0, -1, 0,
        0, 0, 1,
        0, 0, -1,
      ];

      for (let d = 0; d < 18; d += 3) {
        const nx = x + DIRS[d];
        const ny = y + DIRS[d + 1];
        const nz = z + DIRS[d + 2];

        if (nx < 0 || nx >= CSIZE || nz < 0 || nz >= CSIZE || ny < 0 || ny >= WORLD_H) {
          continue;
        }

        const nbBlock = c.blocks[c.idx(nx, ny, nz)];
        if (isOpaque(nbBlock)) continue;

        const cost = nbBlock === B.WATER ? 3 : 1;
        const nl = lvl - cost;
        const ni = this.idx(nx, ny, nz);

        if (nl > this.data[ni]) {
          this.data[ni] = nl;
          queue.push(nx, ny, nz);
        }
      }
    }
  }

  at(lx, y, lz) {
    if (lx < 0 || lx >= CSIZE || lz < 0 || lz >= CSIZE || y < 0 || y >= WORLD_H) {
      return 13; // default outdoor light
    }
    return this.data[this.idx(lx, y, lz)];
  }
}
