/* ============================================================
   VOXELCRAFT — save.js
   Storage strategy:
   - worldMeta: seed, player pos/rot, health/hunger, playtime
   - blockDiffs: Map<"cx,cz", { "lx,y,lz": blockType }>
     Only TOUCHED chunks are recorded; untouched regenerate
     identically from the seed via WorldGen.
   - inventory: slot array JSON
   - furnaces: live container states
   Uses localStorage with debounced writes.
   ============================================================ */

import { CONFIG, B } from '../config.js';

const KEY_META   = 'voxelcraft.meta';
const KEY_DIFFS  = 'voxelcraft.diffs';
const KEY_INV    = 'voxelcraft.inventory';
const KEY_FURN   = 'voxelcraft.furnaces';
const SAVE_VERSION = 1;

export class SaveSystem {
  constructor(world) {
    this.world = world;
    this.dirty = false;
    this.flushTimer = 0;
    this._diffsCache = null;
  }

  // ---------------- recording edits ----------------
  recordEdit(x, y, z, newType) {
    const cs = CONFIG.CHUNK_SIZE;
    const cx = Math.floor(x / cs);
    const cz = Math.floor(z / cs);
    const key = `${cx},${cz}`;

    const store = this._diffs();
    let chunkDiffs = store.get(key);
    if (!chunkDiffs) {
      chunkDiffs = {};
      store.set(key, chunkDiffs);
    }
    const lx = ((x % cs) + cs) % cs;
    const lz = ((z % cs) + cs) % cs;
    chunkDiffs[`${lx},${y},${lz}`] = newType;

    this.dirty = true;
  }

  _diffs() {
    if (!this._diffsCache) {
      this._diffsCache = new Map();
      try {
        const raw = localStorage.getItem(KEY_DIFFS);
        if (raw) {
          for (const [k, v] of Object.entries(JSON.parse(raw)))
            this._diffsCache.set(k, v);
        }
      } catch (e) { console.warn('[save] diffs unreadable, starting fresh', e); }
    }
    return this._diffsCache;
  }

  applyDiffs(chunk) {
    const key = `${chunk.cx},${chunk.cz}`;
    const d = this._diffs().get(key);
    if (!d) return false;
    for (const [pos, type] of Object.entries(d)) {
      const [lx, y, lz] = pos.split(',').map(Number);
      if (chunk.inBounds(lx, y, lz))
        chunk.set(lx, y, lz, type);
    }
    return true;
  }

  hasDiffs(cx, cz) { return this._diffs().has(`${cx},${cz}`); }

  // ---------------- full save ----------------
  saveAll(G) {
    try {
      const p = G.player;
      if (!p) return false;

      localStorage.setItem(KEY_META, JSON.stringify({
        v: SAVE_VERSION,
        seed: G.seed,
        playTime: G.playTime ?? 0,
        time: G.sky?.time ?? 0.3,
        px: p.pos.x, py: p.pos.y, pz: p.pos.z,
        yaw: G.fpsCam?.yaw ?? 0,
        pitch: G.fpsCam?.pitch ?? 0,
        health: p.health, hunger: p.hunger,
      }));

      // serialize diff map
      const obj = {};
      for (const [k, v] of this._diffs()) obj[k] = v;
      localStorage.setItem(KEY_DIFFS, JSON.stringify(obj));

      if (G.inventory) {
        localStorage.setItem(KEY_INV, G.inventory.serialize());
      }

      // furnaces
      if (G.containers) {
        const furnaces = [];
        for (const c of G.containers.map.values()) {
          if (c.type !== 'furnace') continue;
          furnaces.push({
            pos: c.pos,
            input: c.input, fuel: c.fuel, output: c.output,
            burnTime: c.burnTime, burnMax: c.burnMax, cookTime: c.cookTime,
          });
        }
        localStorage.setItem(KEY_FURN, JSON.stringify(furnaces));
      }

      this.dirty = false;
      return true;
    } catch (e) {
      console.error('[save] FAILED — storage full?', e);
      return false;
    }
  }

  // ---------------- load ----------------
  static exists() {
    return !!localStorage.getItem(KEY_META);
  }

  loadInto(G) {
    let meta = null;
    try {
      meta = JSON.parse(localStorage.getItem(KEY_META));
      if (!meta || meta.v !== SAVE_VERSION) throw new Error('bad version');
    } catch {
      return null;
    }

    G.seed = meta.seed;
    this._loadDiffsFromDisk();

    const state = {
      pos: { x: meta.px, y: meta.py, z: meta.pz },
      yaw: meta.yaw ?? 0, pitch: meta.pitch ?? 0,
      health: meta.health ?? 20, hunger: meta.hunger ?? 20,
      playTime: meta.playTime ?? 0,
      time: meta.time ?? 0.3,
    };

    try {
      const invRaw = localStorage.getItem(KEY_INV);
      if (invRaw) G.pendingInventoryJSON = invRaw;
    } catch {}

    try {
      const fRaw = localStorage.getItem(KEY_FURN);
      if (fRaw) G.pendingFurnaces = JSON.parse(fRaw);
    } catch {}

    return state;
  }

  _loadDiffsFromDisk() {
    this._diffsCache = null;
    this._diffs();
  }

  update(dt, G, interval = 20) {
    this.flushTimer += dt;
    if (this.flushTimer >= interval || (this.dirty && this.flushTimer > 8)) {
      this.flushTimer = 0;
      this.saveAll(G);
    }
  }

  static wipe() {
    [KEY_META, KEY_DIFFS, KEY_INV, KEY_FURN].forEach(k => localStorage.removeItem(k));
  }

  static summary() {
    try {
      const m = JSON.parse(localStorage.getItem(KEY_META));
      if (!m) return null;
      const mins = Math.floor((m.playTime ?? 0) / 60);
      return `${mins} min played`;
    } catch { return null; }
  }
}
