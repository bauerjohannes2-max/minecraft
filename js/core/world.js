/* ============================================================
   VOXELCRAFT — world.js
   Manages all chunks: creation, world-space block access,
   dynamic loading/unloading around the player (infinite world),
   and hooks for generation & meshing (provided by other modules).
   ============================================================ */

import { CONFIG, BLOCKS, BLOCK_IDS } from '../config.js';
import { Chunk } from './chunk.js';

export class World {
  constructor(noiseSet) {
    this.noise = noiseSet;                 // from core/noise.js createNoiseSet()
    this.chunks = new Map();               // "cx,cz" -> Chunk
    this.genQueue = [];                    // chunks waiting for terrain gen
    this.meshQueue = [];                   // chunks waiting for remesh
    this.pendingNeighborCheck = new Set(); // chunks that may need mesh now neighbors exist

    // injected later by main.js (dependency wiring):
    this.generateChunk = null;             // fn(chunk)  — from worldgen.js
    this.buildChunkMesh  = null;           // fn(chunk)  — from mesher.js
  }

  // ---------------- chunk keys ----------------
  static key(cx, cz) { return `${cx},${cz}`; }
  key(cx, cz) { return `${cx},${cz}`; }

  // ---------------- world<->chunk coordinate math ----------------
  worldToChunk(w) { return Math.floor(w / CONFIG.CHUNK_SIZE); }
  localCoord(w)   { return ((w % CONFIG.CHUNK_SIZE) + CONFIG.CHUNK_SIZE) % CONFIG.CHUNK_SIZE; }

  getChunk(cx, cz) {
    return this.chunks.get(this.key(cx, cz)) || null;
  }

  getChunkAt(wx, wz) {
    return this.getChunk(this.worldToChunk(wx), this.worldToChunk(wz));
  }

  // ---------------- block access (WORLD coords) ----------------
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CONFIG.WORLD_HEIGHT) return 0; // air above/below
    const c = this.getChunkAt(wx, wz);
    if (!c || !c.generated) return 0;
    return c.get(this.localCoord(wx), wy, this.localCoord(wz));
  }

  setBlock(wx, wy, wz, t) {
    if (wy < 1 || wy >= CONFIG.WORLD_HEIGHT) return false; // bedrock floor protect
    const c = this.getChunkAt(wx, wz);
    if (!c || !c.generated) return false;

    const ok = c.set(this.localCoord(wx), wy, this.localCoord(wz), t);
    if (!ok) return false;

    if (this.onBlockChanged) this.onBlockChanged(wx, wy, wz, t);

    // mark this chunk + possibly border neighbors dirty
    this.queueRemesh(c.cx, c.cz);
    const lx = this.localCoord(wx), lz = this.localCoord(wz);
    if (lx === 0)                  this.queueRemesh(c.cx - 1, c.cz);
    if (lx === CONFIG.CHUNK_SIZE-1)this.queueRemesh(c.cx + 1, c.cz);
    if (lz === 0)                  this.queueRemesh(c.cx, c.cz - 1);
    if (lz === CONFIG.CHUNK_SIZE-1)this.queueRemesh(c.cx, c.cz + 1);
    return true;
  }

  // Convenience for physics/gameplay: solid check with unloaded-chunk fallback
  isSolidAt(wx, wy, wz) {
    if (wy < 0) return true;
    if (wy >= CONFIG.WORLD_HEIGHT) return false;
    const c = this.getChunkAt(wx, wz);
    if (!c || !c.generated) return true;
    return BLOCKS[BLOCK_IDS[c.get(this.localCoord(wx), wy, this.localCoord(wz))]]?.solid ?? false;
  }

  highestBlockAt(wx, wz) {
    const c = this.getChunkAt(wx, wz);
    if (!c || !c.generated) return CONFIG.SEA_LEVEL;
    return c.highestBlock(this.localCoord(wx), this.localCoord(wz));
  }

  // ---------------- streaming around the player ----------------
  updateStreaming(pwx, pwz) {
    const pcx = this.worldToChunk(pwx);
    const pcz = this.worldToChunk(pwz);
    const R = CONFIG.RENDER_DISTANCE;

    // 1. ensure all chunks in radius exist & queued for generation
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        // circular-ish load region (cheaper corners)
        if (dx*dx + dz*dz > (R+0.5)*(R+0.5)) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const k = this.key(cx, cz);
        if (!this.chunks.has(k)) {
          const chunk = new Chunk(cx, cz);
          this.chunks.set(k, chunk);
          this.genQueue.push(chunk);
        }
      }
    }

    // 2. unload far chunks (keep just outside render radius as buffer)
    const maxDistSq = (R + 2) * (R + 2);
    for (const [k, chunk] of this.chunks) {
      const dx = chunk.cx - pcx, dz = chunk.cz - pcz;
      if (dx*dx + dz*dz > maxDistSq) {
        chunk.dispose();
        this.chunks.delete(k);
      }
    }

    // 3. process queues — budgeted per frame to avoid stutter
    this.processQueues();
  }

  processQueues(genBudget = 4, meshBudget = 8) {
    // --- generate terrain ---
    while (genBudget-- > 0 && this.genQueue.length > 0) {
      const chunk = this.pickNearestGen(this.genQueue.length > 4 ? 8 : this.genQueue.length);
      if (!chunk) break;
      this.generateChunk?.(chunk);          // worldgen fills blocks
      chunk.generated = true;
      this.queueRemesh(chunk.cx, chunk.cz);

      // neighbors may now be fully enclosed → their borders need remesh too
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const n = this.getChunk(chunk.cx+dx, chunk.cz+dz);
        if (n?.generated) this.queueRemesh(n.cx, n.cz);
      }
    }

    // --- build meshes ---
    let didMesh = false;
    while (meshBudget-- > 0 && this.meshQueue.length > 0) {
      const chunk = this.meshQueue.shift();
      if (!this.chunks.has(this.key(chunk.cx, chunk.cz))) continue; // unloaded meanwhile
      this.buildChunkMesh?.(chunk);
      didMesh = true;
    }
    return didMesh;
  }

  // prefer generating chunks nearest the player first
  pickNearestGen(lookAhead) {
    if (!this._refPos) { 
      const c = this.genQueue.shift(); 
      return c ?? null; 
    }
    let bestI = -1, bestD = Infinity;
    const lim = Math.min(lookAhead, this.genQueue.length);
    for (let i = 0; i < lim; i++) {
      const ch = this.genQueue[i];
      const dx = ch.cx - this._refPos.x, dz = ch.cz - this._refPos.z;
      const d = dx*dx + dz*dz;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    const chunk = this.genQueue.splice(bestI, 1)[0];
    return chunk ?? null;
  }

  queueRemesh(cx, cz) {
    const c = this.getChunk(cx, cz);
    if (c && !this.meshQueue.includes(c)) {
      c.dirty = true;
      this.meshQueue.push(c);
    }
  }

  setStreamingRef(pos) {
    this._refPos = { x: pos.x, z: pos.z };   // in CHUNK coords
  }

  // initial burst — called on world start so spawn area exists synchronously
  warmup(pwx, pwz, radius = 2) {
    const pcx = this.worldToChunk(pwx), pcz = this.worldToChunk(pwz);
    for (let dx=-radius; dx<=radius; dx++) for (let dz=-radius; dz<=radius; dz++) {
      const cx=pcx+dx, cz=pcz+dz, k=this.key(cx,cz);
      let c = this.chunks.get(k);
      if (!c) { c = new Chunk(cx,cz); this.chunks.set(k,c); }
      if (!c.generated) {
        this.generateChunk?.(c);
        c.generated = true;
      }
    }
    // mesh them (neighbors guaranteed present within radius)
    for (let dx=-radius; dx<=radius; dx++) for (let dz=-radius; dz<=radius; dz++) {
      const c = this.getChunk(pcx+dx, pcz+dz);
      if (c) this.buildChunkMesh?.(c);
    }
  }

  // total block count in memory (debug)
  get stats() {
    let chunks=0, generated=0, dirtyChunks=0;
    this.chunks.forEach(c => { chunks++; if (c.generated) generated++; });
    dirtyChunks = this.meshQueue.length + this.genQueue.length;
    return { chunks, generated, pending: dirtyChunks };
  }
}
