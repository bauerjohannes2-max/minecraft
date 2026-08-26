/* ============================================================
   VOXELCRAFT — worldgen.js
   Real terrain generation:
   - Climate-based biome selection (temperature / moisture)
   - Continental heightmap + ridged mountains
   - 3D-noise carved caves
   - Depth-banded ore veins
   - Trees (oak in plains/forest, spruce-ish in snow), cacti,
     flowers, tall grass — with cross-chunk-safe placement
   ============================================================ */

import { CONFIG, B, BIOMES } from '../config.js';

export class WorldGen {
  constructor(noiseSet) {
    this.n = noiseSet;
    this._decoCache = new Map();
  }

  // ============================================================
  // BIOMES — temperature & moisture fields pick the biome
  // ============================================================
  biomeAt(wx, wz) {
    const t = this.n.biome.fbm2(wx * 0.0035 + 1000, wz * 0.0035 - 1000, 3);
    const m = this.n.biome.fbm2(wx * 0.0045 - 2000, wz * 0.0045 + 2000, 3);

    if (t < -0.35) return m > 0 ? 'SNOWY' : 'MOUNTAINS';
    if (t > 0.35)  return m < -0.1 ? 'DESERT' : 'PLAINS';
    return m > 0.15 ? 'FOREST' : 'PLAINS';
  }

  // ============================================================
  // HEIGHTMAP — continents + ridged mountains blended by mask
  // ============================================================
  terrainHeight(wx, wz) {
    const SEA = CONFIG.SEA_LEVEL;

    const cont = this.n.height.fbm2(wx * 0.0032, wz * 0.0032, 4);
    const mMask = Math.max(0,
      this.n.roughness.fbm2(wx * 0.0028 + 500, wz * 0.0028 + 500, 3));
    const ridge = this.n.height.ridged2(wx * 0.009 + 7777, wz * 0.009 - 7777, 4);
    const hills = this.n.detail.fbm2(wx * 0.02, wz * 0.02, 3);

    let h = SEA + cont * 18 + hills * 4;
    h += mMask * mMask * ridge * 26;

    return Math.max(2, Math.min(CONFIG.WORLD_HEIGHT - 10, Math.floor(h)));
  }

  // ============================================================
  // CHUNK GENERATION — entry point called by World
  // ============================================================
  generate(chunk) {
    const CS = chunk.size;
    const ox = chunk.cx * CS, oz = chunk.cz * CS;
    const SEA = CONFIG.SEA_LEVEL;

    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const wx = ox + lx, wz = oz + lz;
        const h = this.terrainHeight(wx, wz);
        const biomeName = this.biomeAt(wx, wz);
        const biome = BIOMES[biomeName] || BIOMES.PLAINS;
        const surfBlock = B[biome.surface] ?? B.GRASS;
        const fillBlock = B[biome.filler] ?? B.DIRT;

        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let t;
          if (y === 0) t = B.BEDROCK;
          else if (y <= 2 && this.n.caves.noise3(wx * 0.9, y, wz * 0.9) > 0)
            t = B.BEDROCK;
          else if (y < h - 3) {
            t = B.STONE;
            t = this.tryOre(t, wx, y, wz);
            if (this.isCave(wx, y, wz, h)) t = B.AIR;
          }
          else if (y < h)  t = this.isCave(wx, y, wz, h) ? B.AIR : fillBlock;
          else if (y === h) {
            if (h < SEA + 2)                                 t = B.SAND;
            else if (biome.snowLine && h >= biome.snowLine) t = B.SNOW;
            else                                             t = surfBlock;
          }
          else t = B.WATER;

          chunk.blocks[chunk.idx(lx, y, lz)] = t ?? B.STONE;
        }
      }
    }

    this.decorate(chunk);
    this.computeHeightMap(chunk);
  }

  // ============================================================
  // CAVES
  // ============================================================
  isCave(wx, y, wz, h = 60) {
    if (y < 4 || y > CONFIG.WORLD_HEIGHT - 20) return false;
    // protect ocean/lake beds from collapsing into caves
    if (y > h - 4 && h <= CONFIG.SEA_LEVEL + 2) return false;
    if (y > h - 3) return false;

    const a = this.n.caves.fbm3(wx * 0.03, y * 0.05, wz * 0.03, 2);
    const b = this.n.ore.fbm3(wx * 0.03 + 900, y * 0.05, wz * 0.03 + 900, 2);

    const nearSurfaceFade = Math.max(0, (y - (CONFIG.SEA_LEVEL + 12)) / 12);
    const thresh = 0.35 + nearSurfaceFade * 0.25;

    return a > thresh && b > thresh;
  }

  // ============================================================
  // ORES
  // ============================================================
  tryOre(defaultStone, wx, y, wz) {
    const v = this.n.ore.noise3(wx * 0.11, y * 0.11, wz * 0.11);

    if (y < 14 && v > 0.72) return B.DIAMOND_ORE;
    if (y < 22 && v > 0.68) return B.GOLD_ORE;
    if (y < 40 && v > 0.62) return B.IRON_ORE;
    if (v > 0.58)           return B.COAL_ORE;
    if (v < -0.74)          return B.GRAVEL;
    return defaultStone;
  }

  // ============================================================
  // DECORATIONS
  // ============================================================
  hash(x, z) {
    let h = (x * 374761393 + z * 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  setSafe(chunk, lx, y, lz, t, replaceSolid = false) {
    if (!chunk.inBounds(lx, y, lz)) return false;
    const cur = chunk.get(lx, y, lz);
    if (!replaceSolid && cur !== B.AIR && cur !== B.WATER) return false;
    chunk.set(lx, y, lz, t);
    return true;
  }

  decorate(chunk) {
    const CS = chunk.size;
    const ox = chunk.cx * CS, oz = chunk.cz * CS;

    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const wx = ox + lx, wz = oz + lz;
        const h = this.terrainHeight(wx, wz);
        if (h < CONFIG.SEA_LEVEL + 2) continue;

        const biomeName = this.biomeAt(wx, wz);
        const biome = BIOMES[biomeName] || BIOMES.PLAINS;
        const top = chunk.get(lx, h, lz);
        const r = this.hash(wx, wz);

        // ---------- trees ----------
        if (biome.trees && r < biome.trees &&
            (top === B.GRASS || top === B.SNOW)) {
          if (biomeName === 'SNOWY') this.spruceTree(chunk, lx, h + 1, lz, wx, wz);
          else                       this.oakTree(chunk, lx, h + 1, lz, wx, wz);
          continue;
        }

        // ---------- cactus ----------
        if (biome.cacti && r < 0.0025 && top === B.SAND) {
          const ch = 2 + ((r * 1000) | 0) % 2;
          for (let i = 0; i < ch; i++)
            this.setSafe(chunk, lx, h + 1 + i, lz, B.CACTUS);
          continue;
        }

        // ---------- flowers & grass ----------
        if (biome.flowers && top === B.GRASS) {
          if (r < 0.01)                    this.setSafe(chunk, lx, h + 1, lz, B.FLOWER);
          else if (r < 0.06)               this.setSafe(chunk, lx, h + 1, lz, B.TALLGRASS);
        }
      }
    }
  }

  oakTree(chunk, bx, by, bz, wx, wz) {
    const trunkH = 4 + ((this.hash(wx * 3 + 11, wz * 7 - 13) * 3) | 0);
    for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
      const rad = dy >= trunkH ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad &&
              this.hash(wx + dx + dy, wz + dz) < 0.5) continue;
          this.setSafe(chunk, bx + dx, by + dy, bz + dz, B.LEAVES);
        }
    }
    for (let i = 0; i < trunkH; i++)
      this.setSafe(chunk, bx, by + i, bz, B.WOOD_LOG, true);
  }

  spruceTree(chunk, bx, by, bz, wx, wz) {
    const trunkH = 6 + ((this.hash(wx, wz * 5) * 3) | 0);
    for (let i = 0; i < trunkH; i++)
      this.setSafe(chunk, bx, by + i, bz, B.WOOD_LOG, true);
    for (let layer = 0; layer < 4; layer++) {
      const ly = by + trunkH - 1 - layer * 2;
      const rad = Math.min(2, layer);
      for (let dx = -rad; dx <= rad; dx++)
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
          this.setSafe(chunk, bx + dx, ly, bz + dz, B.LEAVES);
        }
    }
    this.setSafe(chunk, bx, by + trunkH, bz, B.LEAVES);
  }

  computeHeightMap(chunk) {
    const CS = chunk.size;
    for (let lx = 0; lx < CS; lx++)
      for (let lz = 0; lz < CS; lz++) {
        let top = 0;
        for (let y = CONFIG.WORLD_HEIGHT - 1; y >= 0; y--)
          if (chunk.get(lx, y, lz) !== B.AIR) { top = y; break; }
        chunk.heightMap[lz * CS + lx] = top;
      }
  }
}
