/* ============================================================
   VOXELCRAFT — textures.js
   Procedurally generates a pixel-art texture atlas on a canvas.
   Every block face tile is drawn with seeded randomness so it
   looks hand-crafted. Exposes UV lookup used by the mesher.
   ============================================================ */

import * as THREE from 'three';
import { BLOCK_FACE_TILES } from '../config.js';

// ---------------- tile painters ----------------
// Each painter draws INTO ctx at (ox, oy), 16x16 pixels.
const PAINTERS = {
  grass_top(ctx, ox, oy) {
    base(ctx, ox, oy, '#6DAF4B');
    speckle(ctx, ox, oy, ['#7CC159', '#5D9A3E', '#87CC66'], 90);
  },
  grass_side(ctx, ox, oy) {
    dirtPaint(ctx, ox, oy);
    // green fringe hanging over the top
    for (let x = 0; x < 16; x++) {
      const h = 3 + ((x * 7 + 3) % 3);        // wavy edge
      ctx.fillStyle = '#6DAF4B';
      ctx.fillRect(ox + x, oy, 1, h);
      ctx.fillStyle = '#5D9A3E';
      if ((x + 1) % 3 === 0) ctx.fillRect(ox + x, oy + h - 1, 1, 1);
    }
  },
  dirt(ctx, ox, oy) { dirtPaint(ctx, ox, oy); },

  stone(ctx, ox, oy) {
    base(ctx, ox, oy, '#8a8a8a');
    speckle(ctx, ox, oy, ['#7d7d7d', '#969696', '#828282'], 70);
    // subtle cracks
    ctx.fillStyle = '#767676';
    ctx.fillRect(ox+4, oy+2, 2, 1); ctx.fillRect(ox+10, oy+8, 2, 1);
    ctx.fillRect(ox+2, oy+12, 1, 2); ctx.fillRect(ox+13, oy+4, 1, 2);
  },
  cobble(ctx, ox, oy) {
    base(ctx, ox, oy, '#7f7f7f');
    ctx.fillStyle = '#999';
    for (const [sx,sy,sw,sh] of [[0,0,7,7],[8,0,8,5],[8,6,8,5],[0,8,6,5],[7,12,9,4]]) {
      ctx.fillRect(ox+sx+1, oy+sy+1, sw-1, sh-1);
    }
    speckle(ctx, ox, oy, ['#6f6f6f','#a5a5a5'], 40);
  },
  sand(ctx, ox, oy) {
    base(ctx, ox, oy, '#DBCF9C');
    speckle(ctx, ox, oy, ['#E4DAA9','#D2C48F','#EAE0B4'], 80);
  },
  gravel(ctx, ox, oy) {
    base(ctx, ox, oy, '#8d8579');
    speckle(ctx, ox, oy, ['#7a736a','#9c948a','#6b655e','#a8a096'], 120);
  },
  log_side(ctx, ox, oy) {
    base(ctx, ox, oy, '#6B4A28');
    // vertical bark stripes
    for (let x = 0; x < 16; x += 2 + (x % 3)) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(ox+x, oy, 1, 16);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(ox+3, oy, 1, 16); ctx.fillRect(ox+11, oy, 1, 16);
  },
  log_top(ctx, ox, oy) {
    base(ctx, ox, oy, '#A8834F');
    // growth rings
    ctx.strokeStyle = '#7A5A30';
    for (let r = 2; r <= 7; r += 2) {
      ctx.beginPath();
      ctx.arc(ox+8, oy+8, r, 0, Math.PI*2);
      ctx.stroke();
    }
  },
  planks(ctx, ox, oy) {
    base(ctx, ox, oy, '#A07A45');
    // horizontal boards
    ctx.fillStyle = '#8A6538';
    for (let y = 3; y < 16; y += 4) ctx.fillRect(ox, oy+y, 16, 1);
    // board seams
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(ox+4, oy, 1, 4); ctx.fillRect(ox+11, oy+4, 1, 4);
    ctx.fillRect(ox+6, oy+8, 1, 4); ctx.fillRect(ox+13, oy+12, 1, 4);
  },
  leaves(ctx, ox, oy) {
    base(ctx, ox, oy, '#3E7A2E');
    speckle(ctx, ox, oy, ['#2E5F22','#4C9238','#57A341','#26501C'], 130);
  },
  bedrock(ctx, ox, oy) {
    base(ctx, ox, oy, '#444');
    speckle(ctx, ox, oy, ['#333','#555','#222','#666'], 140);
  },
  snow(ctx, ox, oy) {
    base(ctx, ox, oy, '#F2F5F7');
    speckle(ctx, ox, oy, ['#FFFFFF','#E4EAEE'], 50);
  },
  snow_side(ctx, ox, oy) {
    dirtPaint(ctx, ox, oy);
    ctx.fillStyle = '#F2F5F7';
    ctx.fillRect(ox, oy, 16, 4);
    ctx.fillStyle = '#E4EAEE';
    ctx.fillRect(ox, oy+4, 16, 1);
  },
  water(ctx, ox, oy) {
    base(ctx, ox, oy, '#3568C8');
    for (let y = 0; y < 16; y += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(ox + ((y*3)%5), oy+y, 10, 1);
    }
    ctx.fillStyle = 'rgba(0,0,40,0.18)';
    ctx.fillRect(ox+2, oy+9, 12, 1);
  },
  cactus_top(ctx, ox, oy) {
    base(ctx, ox, oy, '#4E8F3A');
    speckle(ctx, ox, oy, ['#5CA345','#437D32'], 50);
  },
  cactus_side(ctx, ox, oy) {
    base(ctx, ox, oy, '#47943B');
    ctx.fillStyle = '#3B7A31';
    ctx.fillRect(ox+1, oy, 1, 16); ctx.fillRect(ox+14, oy, 1, 16);
    ctx.fillStyle = '#E8F5D0';
    for (let y = 1; y < 16; y += 4) {
      ctx.fillRect(ox+4, oy+y, 1, 1); ctx.fillRect(ox+11, oy+y+2, 1, 1);
    }
  },
  flower(ctx, ox, oy) {
    clear(ctx, ox, oy);
    ctx.fillStyle = '#3E7A2E';
    ctx.fillRect(ox+7, oy+8, 2, 8);
    ctx.fillRect(ox+4, oy+11, 3, 1);
    ctx.fillRect(ox+9, oy+13, 3, 1);
    const petals = [[6,4],[9,4],[5,6],[10,6],[6,8],[9,8]];
    ctx.fillStyle = '#E24A4A';
    for (const [px,py] of petals) ctx.fillRect(ox+px, oy+py, 2, 2);
    ctx.fillStyle = '#FFD84A';
    ctx.fillRect(ox+7, oy+5, 3, 3);
  },
  tallgrass(ctx, ox, oy) {
    clear(ctx, ox, oy);
    for (let i = 0; i < 7; i++) {
      const bx = 1 + i*2;
      const h = 6 + ((i*31) % 8);
      ctx.fillStyle = i % 2 ? '#5D9A3E' : '#6DAF4B';
      for (let yy = 0; yy < h; yy++)
        ctx.fillRect(ox + bx + (yy>h-3?(i%2?1:-1):0), oy+15-yy, 1, 1);
    }
  },
  torch(ctx, ox, oy) {
    clear(ctx, ox, oy);
    ctx.fillStyle = '#6B4A28';
    ctx.fillRect(ox+7, oy+6, 2, 9);
    ctx.fillStyle = '#FFAA00';
    ctx.fillRect(ox+6, oy+2, 4, 4);
    ctx.fillStyle = '#FFEE55';
    ctx.fillRect(ox+7, oy+3, 2, 2);
  },
  craft_top(ctx, ox, oy) {
    base(ctx, ox, oy, '#A07A45');
    ctx.fillStyle = '#6B4A28';
    ctx.fillRect(ox+1, oy+1, 14, 14);
    ctx.fillStyle = '#C8A064';
    ctx.fillRect(ox+2, oy+2, 6, 6); ctx.fillRect(ox+8, oy+2, 6, 6);
    ctx.fillRect(ox+2, oy+8, 6, 6); ctx.fillRect(ox+8, oy+8, 6, 6);
  },
  craft_side(ctx, ox, oy) {
    base(ctx, ox, oy, '#8A6538');
    ctx.fillStyle = '#5A3D1E';
    ctx.fillRect(ox+2, oy+2, 12, 12);
    ctx.fillStyle = '#A07A45';
    ctx.fillRect(ox+4, oy+4, 8, 8);
  },
  furnace_top(ctx, ox, oy) {
    base(ctx, ox, oy, '#6E6E6E');
    speckle(ctx, ox, oy, ['#555','#888'], 40);
  },
  furnace_front(ctx, ox, oy) {
    base(ctx, ox, oy, '#6E6E6E');
    ctx.fillStyle = '#222';
    ctx.fillRect(ox+3, oy+4, 10, 8);
    ctx.fillStyle = '#444';
    ctx.fillRect(ox+4, oy+5, 8, 6);
  },
  glass(ctx, ox, oy) {
    clear(ctx, ox, oy);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(ox, oy, 16, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(ox+2, oy+2, 1, 4); ctx.fillRect(ox+3, oy+2, 4, 1);
  },
  coal_ore(ctx, ox, oy)  { orePaint(ctx, ox, oy, '#232323'); },
  iron_ore(ctx, ox, oy)  { orePaint(ctx, ox, oy, '#D8AF93'); },
  gold_ore(ctx, ox, oy)  { orePaint(ctx, ox, oy, '#FCEE4B'); },
  diamond_ore(ctx, ox, oy){ orePaint(ctx, ox, oy, '#4AEDD9'); },
};

function base(ctx, ox, oy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(ox, oy, 16, 16);
}
function clear(ctx, ox, oy) {
  ctx.clearRect(ox, oy, 16, 16);
}
function speckle(ctx, ox, oy, colors, n) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.fillRect(ox + ((Math.random()*16)|0), oy + ((Math.random()*16)|0), 1, 1);
  }
}
function dirtPaint(ctx, ox, oy) {
  base(ctx, ox, oy, '#79553A');
  speckle(ctx, ox, oy, ['#6B4A30','#8A6244','#5E4029','#93704E'], 90);
}
function orePaint(ctx, ox, oy, gemColor) {
  PAINTERS.stone(ctx, ox, oy);
  const blobs = [[3,3],[9,2],[5,9],[11,10],[12,5]];
  ctx.fillStyle = gemColor;
  for (const [bx,by] of blobs) {
    ctx.fillRect(ox+bx, oy+by, 2, 2);
    ctx.fillRect(ox+bx+ (bx%2), oy+by+1, 1, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(ox+3, oy+3, 1, 1);
  ctx.fillRect(ox+11, oy+10, 1, 1);
}

// ---------------- build the atlas ----------------

const TILE_NAMES = new Set();
for (const key of Object.keys(BLOCK_FACE_TILES)) {
  const [top, bottom, side] = BLOCK_FACE_TILES[key];
  TILE_NAMES.add(top); TILE_NAMES.add(bottom); TILE_NAMES.add(side);
}

export const TILES = [...TILE_NAMES].sort();
export const TILE_INDEX = Object.fromEntries(TILES.map((t,i)=>[t,i]));
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = Math.ceil(TILES.length / ATLAS_COLS);

let _texture = null;

export function getAtlasTexture() {
  if (_texture) return _texture;

  const TS = 16;
  const canvas = document.createElement('canvas');
  canvas.width  = ATLAS_COLS * TS;
  canvas.height = ATLAS_ROWS * TS;
  const ctx = canvas.getContext('2d');

  TILES.forEach((name, i) => {
    const ox = (i % ATLAS_COLS) * TS;
    const oy = Math.floor(i / ATLAS_COLS) * TS;
    const painter = PAINTERS[name];
    if (!painter) {
      console.warn(`[textures] no painter for "${name}" — magenta placeholder`);
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(ox, oy, TS, TS);
      return;
    }
    painter(ctx, ox, oy);
  });

  _texture = new THREE.CanvasTexture(canvas);
  _texture.magFilter = THREE.NearestFilter;
  _texture.minFilter = THREE.NearestFilter;
  _texture.generateMipmaps = false;
  _texture.colorSpace = THREE.SRGBColorSpace;
  console.log(`[textures] atlas built: ${TILES.length} tiles, ${canvas.width}x${canvas.height}`);
  return _texture;
}

export function tileUV(name) {
  const i = TILE_INDEX[name] ?? 0;
  const col = i % ATLAS_COLS, row = Math.floor(i / ATLAS_COLS);
  const e = 0.001;
  return [
    col / ATLAS_COLS + e,
    1 - (row + 1) / ATLAS_ROWS + e,
    (col + 1) / ATLAS_COLS - e,
    1 - row / ATLAS_ROWS - e,
  ];
}

export function tileThumbDataURL(name) {
  const TS = 16;
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');
  (PAINTERS[name] ?? (()=>{}))(ctx, 0, 0);
  return c.toDataURL();
}
