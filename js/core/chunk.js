/* ============================================================
   VOXELCRAFT — chunk.js
   A chunk is a 16 x WORLD_HEIGHT x 16 column of blocks stored
   in a flat Uint8Array. Fast get/set, dirty-flag for remeshing.
   ============================================================ */

import { CONFIG, NUM_BLOCK_IDS, B } from '../config.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;                      // chunk coordinate (x)
    this.cz = cz;                      // chunk coordinate (z)
    this.size = CONFIG.CHUNK_SIZE;     // 16
    this.height = CONFIG.WORLD_HEIGHT;

    // flat array: index = (y * size + z) * size + x
    const len = this.size * this.size * this.height;
    this.blocks = new Uint8Array(len);

    // per-block sunlight propagation value (0..15), built in lighting pass
    // (Part 20 upgrades this — simple heightmap-based light for now)
    this.light = null;

    this.dirty = true;        // needs remeshing?
    this.generated = false;   // terrain filled in?
    this.meshes = [];         // THREE.Mesh objects assigned by mesher

    // highest non-air block per column — speeds up lighting & spawning
    this.heightMap = new Uint8Array(this.size * this.size);
  }

  // -------- local coordinates → array index --------
  idx(x, y, z) {
    return (y * this.size + z) * this.size + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.size &&
           y >= 0 && y < this.height &&
           z >= 0 && z < this.size;
  }

  // -------- block access (LOCAL coords) --------
  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  set(x, y, z, t) {
    if (!this.inBounds(x, y, z)) return false;
    const i = this.idx(x, y, z);
    if (this.blocks[i] === t) return false;
    this.blocks[i] = t;

    // update heightmap column if needed
    const col = z * this.size + x;
    if (t !== B.AIR && y > this.heightMap[col]) {
      this.heightMap[col] = y;
    } else if (t === B.AIR && y === this.heightMap[col]) {
      // scan down to find the new top
      let ny = y - 1;
      while (ny > 0 && this.get(x, ny, z) === B.AIR) ny--;
      this.heightMap[col] = ny;
    }

    this.dirty = true;
    return true;
  }

  // -------- helpers --------
  highestBlock(x, z) {
    return this.heightMap[z * this.size + x];
  }

  // world-space position of chunk origin corner
  origin() {
    return [this.cx * this.size, this.cz * this.size];
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry?.dispose();
      if (m.parent) m.parent.remove(m);
    }
    this.meshes = [];
  }
}
