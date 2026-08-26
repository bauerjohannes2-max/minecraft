/* ============================================================
   VOXELCRAFT — noise.js
   Seeded Perlin noise (2D & 3D) + fractal (fBm) helpers.
   Classic Ken Perlin improved-noise algorithm, with a seeded
   permutation table so worlds are reproducible from a seed.
   ============================================================ */

export class Perlin {
  constructor(seed = 1337) {
    this.seed = seed;
    // --- build permutation table from seeded PRNG ---
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // mulberry32 PRNG (fast, good enough for terrain)
    let s = seed >>> 0;
    const rand = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    // duplicate to allow p[x+256] without wrapping
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  // ---------------- gradients ----------------
  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(a, b, t) { return a + t * (b - a); }

  static grad2(hash, x, y) {
    // 8 directions
    switch (hash & 7) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      case 3: return -x - y;
      case 4: return  x;
      case 5: return -x;
      case 6: return  y;
      default: return -y;
    }
  }

  static grad3(hash, x, y, z) {
    // Perlin's original 12 gradient vectors via bit tricks
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  // ---------------- 2D noise ----------------
  // Returns approx range [-1, 1]
  noise2(x, y) {
    const P = this.perm;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = Perlin.fade(x);
    const v = Perlin.fade(y);

    const A  = P[X] + Y;
    const B  = P[X + 1] + Y;

    return Perlin.lerp(
      Perlin.lerp(
        Perlin.grad2(P[A],     x,     y    ),
        Perlin.grad2(P[B],     x - 1, y    ), u),
      Perlin.lerp(
        Perlin.grad2(P[A + 1], x,     y - 1),
        Perlin.grad2(P[B + 1], x - 1, y - 1), u), v);
  }

  // ---------------- 3D noise ----------------
  noise3(x, y, z) {
    const P = this.perm;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = Perlin.fade(x);
    const v = Perlin.fade(y);
    const w = Perlin.fade(z);

    const A  = P[X] + Y,   AA = P[A] + Z, AB = P[A + 1] + Z;
    const Bb = P[X + 1] + Y, BA = P[Bb] + Z, BB = P[Bb + 1] + Z;

    return Perlin.lerp(
      Perlin.lerp(
        Perlin.lerp(Perlin.grad3(P[AA],     x,     y,     z    ),
                    Perlin.grad3(P[BA],     x - 1, y,     z    ), u),
        Perlin.lerp(Perlin.grad3(P[AB],     x,     y - 1, z    ),
                    Perlin.grad3(P[BB],     x - 1, y - 1, z    ), u), v),
      Perlin.lerp(
        Perlin.lerp(Perlin.grad3(P[AA + 1], x,     y,     z - 1),
                    Perlin.grad3(P[BA + 1], x - 1, y,     z - 1), u),
        Perlin.lerp(Perlin.grad3(P[AB + 1], x,     y - 1, z - 1),
                    Perlin.grad3(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }

  // ---------------- Fractal Brownian Motion (fBm) ----------------
  // Layered octaves of noise → natural-looking detail.
  // Returns approx [-1, 1].

  fbm2(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum  += amp * this.noise2(x * freq, y * freq);
      norm += amp;
      amp  *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  fbm3(x, y, z, octaves = 3, lacunarity = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum  += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp  *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  // ---------------- domain helpers ----------------

  // Ridged noise — sharp mountain ridges. Returns [0, 1].
  ridged2(x, y, octaves = 4) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum  += amp * (1 - Math.abs(this.noise2(x * freq, y * freq)));
      norm += amp;
      amp  *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  // Recentered to [-1, 1]
  fbm2Signed(x, y, octaves = 4) {
    return this.fbm2(x, y, octaves) * 2 - 1;
  }
}

// ---------------- One shared instance set ----------------
// Multiple independent noise fields so terrain/biomes/caves/trees
// don't correlate with each other.
export function createNoiseSet(worldSeed = Date.now()) {
  return {
    height:  new Perlin(worldSeed),       // terrain heightmap
    detail:  new Perlin(worldSeed ^ 0x9E3779B9),
    biome:   new Perlin(worldSeed ^ 0x51F15EED),
    caves:   new Perlin(worldSeed ^ 0xC0FFEE42),
    ore:     new Perlin(worldSeed ^ 0xABAD1DEA),
    trees:   new Perlin(worldSeed ^ 0x7F3EED07),
    roughness: new Perlin(worldSeed ^ 0xDECAFBAD),
  };
}
