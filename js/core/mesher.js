/* ============================================================
   VOXELCRAFT — mesher.js
   Builds optimized BufferGeometry from chunk voxel data.
   - Face culling: only faces touching air/transparency are built
   - Cross-quad meshing for flowers, tallgrass, torches with alpha cutout
   - Per-face directional shading baked into vertex colors
   - Water separated into its own transparent mesh
   ============================================================ */

import * as THREE from 'three';
import { B, BLOCK_IDS, BLOCKS, BLOCK_FACE_TILES } from '../config.js';
import { getAtlasTexture, tileUV } from '../graphics/textures.js';

const CROSS_BLOCKS = new Set([B.TALLGRASS, B.FLOWER, B.TORCH].filter(x => x !== undefined));

// face definitions: dir, 4 corners (unit cube), and which tile slot
// tileSlot: 0=top, 1=bottom, 2=side
const FACES = [
  { dir:[ 1, 0, 0], corners:[[1,1,0],[1,0,0],[1,1,1],[1,0,1]], shade:0.78, tileSlot:2 },
  { dir:[-1, 0, 0], corners:[[0,1,1],[0,0,1],[0,1,0],[0,0,0]], shade:0.78, tileSlot:2 },
  { dir:[ 0, 1, 0], corners:[[0,1,1],[1,1,1],[0,1,0],[1,1,0]], shade:1.00, tileSlot:0 },
  { dir:[ 0,-1, 0], corners:[[1,0,1],[0,0,1],[1,0,0],[0,0,0]], shade:0.55, tileSlot:1 },
  { dir:[ 0, 0, 1], corners:[[1,1,1],[1,0,1],[0,1,1],[0,0,1]], shade:0.68, tileSlot:2 },
  { dir:[ 0, 0,-1], corners:[[0,1,0],[0,0,0],[1,1,0],[1,0,0]], shade:0.68, tileSlot:2 },
];
const QUAD_INDICES = [0,1,2, 2,1,3];

let _opaqueMat = null, _waterMat = null, _crossMat = null;

function materials() {
  if (!_opaqueMat) {
    const map = getAtlasTexture();
    _opaqueMat = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    _waterMat  = new THREE.MeshLambertMaterial({
      map, vertexColors: true,
      transparent: true, opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    _crossMat = new THREE.MeshLambertMaterial({
      map, vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }
  return { opaqueMat: _opaqueMat, waterMat: _waterMat, crossMat: _crossMat };
}

function faceVisible(selfT, nbT) {
  if (nbT === undefined) return true; // outside loaded world -> draw

  const tIsWater = selfT === B.WATER;
  const tIsCross = CROSS_BLOCKS.has(selfT);
  if (tIsCross) return false;

  if (tIsWater) {
    // water shows faces only against air & non-water transparent stuff
    return nbT === B.AIR || CROSS_BLOCKS.has(nbT);
  }

  // solid blocks: draw face if neighbor is see-through in ANY way
  return nbT === B.AIR || nbT === B.WATER || CROSS_BLOCKS.has(nbT) || (BLOCKS[BLOCK_IDS[nbT]]?.transparent ?? false);
}

function emitCross(t, x, y, z, buf, tileName) {
  const [u0, v0, u1, v1] = tileUV(tileName);
  const a = 0.15, b = 0.85;

  const quads = [
    [[x+a, y, z+a], [x+b, y, z+b], [x+b, y+1, z+b], [x+a, y+1, z+a]],
    [[x+b, y, z+a], [x+a, y, z+b], [x+a, y+1, z+b], [x+b, y+1, z+a]],
  ];

  for (const q of quads) {
    const base = buf.v;
    for (const [px, py, pz] of q) {
      buf.pos.push(px, py, pz);
      buf.norm.push(0, 1, 0);
      buf.col.push(0.9, 0.9, 0.9);
    }
    buf.uv.push(u0, v1,  u1, v1,  u1, v0,  u0, v0);
    buf.idx.push(base, base+1, base+2,  base, base+2, base+3);
    buf.v += 4;
  }
}

export function meshChunk(chunk, world, scene) {
  const { opaqueMat, waterMat, crossMat } = materials();

  for (const m of chunk.meshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  chunk.meshes = [];

  const CS = chunk.size, WH = chunk.height;

  const bufs = {
    opaque: { pos:[], norm:[], uv:[], col:[], idx:[], v:0 },
    water:  { pos:[], norm:[], uv:[], col:[], idx:[], v:0 },
    cross:  { pos:[], norm:[], uv:[], col:[], idx:[], v:0 },
  };

  const ox = chunk.cx * CS, oz = chunk.cz * CS;

  function blockAt(x, y, z) {
    if (y < 0 || y >= WH) return B.AIR;
    if (x >= 0 && x < CS && z >= 0 && z < CS) return chunk.get(x, y, z);
    return world.getBlock(ox + x, y, oz + z);
  }

  for (let y = 0; y < WH; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const t = chunk.get(x, y, z);
        if (t === B.AIR) continue;

        const faceTiles = BLOCK_FACE_TILES[t];
        if (!faceTiles) continue;

        // Cross-block check (tallgrass, flowers, torches)
        if (CROSS_BLOCKS.has(t)) {
          emitCross(t, x, y, z, bufs.cross, faceTiles[2] ?? faceTiles[0]);
          continue;
        }

        const target = t === B.WATER ? bufs.water : bufs.opaque;

        for (const f of FACES) {
          const nb = blockAt(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
          if (!faceVisible(t, nb)) continue;

          const tileName = faceTiles[f.tileSlot] ?? faceTiles[2];
          const [u0, v0, u1, v1] = tileUV(tileName);

          const uvs = [[u0,v1],[u0,v0],[u1,v1],[u1,v0]];
          const isWaterTop = t === B.WATER && f.dir[1] === 1;

          for (let ci = 0; ci < 4; ci++) {
            const cr = f.corners[ci];
            const yy = isWaterTop ? cr[1] - 0.12 : cr[1];
            target.pos.push(x + cr[0], y + yy, z + cr[2]);
            target.norm.push(f.dir[0], f.dir[1], f.dir[2]);
            target.col.push(f.shade, f.shade, f.shade);
            target.uv.push(uvs[ci][0], uvs[ci][1]);
          }
          for (const qi of QUAD_INDICES) target.idx.push(target.v + qi);
          target.v += 4;
        }
      }
    }
  }

  const originX = chunk.cx * CS, originZ = chunk.cz * CS;

  for (const [kind, buf] of Object.entries(bufs)) {
    if (!buf.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(buf.norm, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(buf.col, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(buf.uv, 2));
    geo.setIndex(buf.idx);
    geo.computeBoundingSphere();

    let mat = opaqueMat;
    if (kind === 'water') mat = waterMat;
    else if (kind === 'cross') mat = crossMat;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(originX, 0, originZ);
    mesh.renderOrder = kind === 'water' ? 1 : 0;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    chunk.meshes.push(mesh);
  }

  chunk.dirty = false;
  return chunk.meshes.length;
}
