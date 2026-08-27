/* ============================================================
   VOXELCRAFT — models.js
   Builds Three.js groups out of colored/shaded boxes.
   Flat lambert materials — chunky Minecraft aesthetic.
   Returns { group, parts:{...} } for animation (leg swing etc.)
   ============================================================ */

import * as THREE from 'three';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

export function buildPigModel() {
  const g = new THREE.Group();
  const PINK = 0xf5a3b7, PINK_DK = 0xe0859a, SNOUT = 0xd86c87;

  const body = box(0.62, 0.5, 1.0, PINK, 0, 0.65, 0);
  g.add(body);
  const head = box(0.5, 0.5, 0.5, PINK, 0, 0.75, 0.68);
  const snout = box(0.25, 0.18, 0.08, SNOUT, 0, 0.7, 0.96);
  const eyeL = box(0.08, 0.08, 0.02, 0x111111, -0.14, 0.85, 0.94);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.14;
  g.add(head, snout, eyeL, eyeR);

  const legs = [];
  for (const [lx, lz] of [[-0.18,-0.32],[0.18,-0.32],[-0.18,0.32],[0.18,0.32]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.4, lz);
    leg.add(box(0.16, 0.4, 0.16, PINK_DK, 0, -0.2, 0));
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs };
}

export function buildZombieModel() {
  const g = new THREE.Group();
  const SKIN = 0x53a044, SHIRT = 0x00AAAA, PANTS = 0x263A66;

  const body = box(0.5, 0.72, 0.28, SHIRT, 0, 1.26, 0);
  const head = box(0.48, 0.48, 0.48, SKIN, 0, 1.86, 0);
  const eyeL = box(0.09, 0.09, 0.02, 0x111111, -0.11, 1.9, 0.25);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.11;
  g.add(body, head, eyeL, eyeR);

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.33, 1.56, 0);
    arm.rotation.x = -Math.PI / 2;
    arm.add(box(0.16, 0.7, 0.16, SKIN, 0, -0.3, 0));
    g.add(arm);
    arms.push(arm);
  }

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.13, 0.9, 0);
    leg.add(box(0.17, 0.9, 0.17, PANTS, 0, -0.45, 0));
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs, arms };
}

export function buildSheepModel() {
  const g = new THREE.Group();
  const WOOL = 0xe8e8e8, SKIN = 0xd8c8b8;
  g.add(box(0.7, 0.65, 1.1, WOOL, 0, 0.85, 0));
  const head = box(0.4, 0.4, 0.45, SKIN, 0, 1.0, 0.72);
  g.add(head);
  const legs = [];
  for (const [lx, lz] of [[-0.2,-0.35],[0.2,-0.35],[-0.2,0.35],[0.2,0.35]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.55, lz);
    leg.add(box(0.15, 0.55, 0.15, SKIN, 0, -0.27, 0));
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs };
}

export function buildCowModel() {
  const g = new THREE.Group();
  const HIDE = 0x4a3626, SPOT = 0xf0f0f0;
  g.add(box(0.75, 0.7, 1.2, HIDE, 0, 0.95, 0));
  g.add(box(0.3, 0.3, 0.02, SPOT, 0.18, 1.1, 0.61));
  const head = box(0.45, 0.45, 0.5, HIDE, 0, 1.15, 0.78);
  g.add(head);
  g.add(box(0.08, 0.12, 0.08, 0xc0c0c0, -0.16, 1.42, 0.74));
  g.add(box(0.08, 0.12, 0.08, 0xc0c0c0,  0.16, 1.42, 0.74));
  const legs = [];
  for (const [lx, lz] of [[-0.22,-0.4],[0.22,-0.4],[-0.22,0.4],[0.22,0.4]]) {
    const leg = new THREE.Group();
    leg.position.set(lx, 0.62, lz);
    leg.add(box(0.17, 0.62, 0.17, HIDE, 0, -0.31, 0));
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, legs };
}

export function buildPlayerAvatar(name) {
  const g = new THREE.Group();
  const SKIN = 0xd8a47a, SHIRT = 0x2288bb, PANTS = 0x2a386a, HAIR = 0x4a3222;

  g.add(box(0.5, 0.65, 0.28, SHIRT, 0, 1.25, 0));   // Torso
  g.add(box(0.42, 0.42, 0.42, SKIN, 0, 1.78, 0));  // Head
  g.add(box(0.44, 0.14, 0.44, HAIR, 0, 1.95, 0));  // Hair

  // Arms
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.35, 1.5, 0);
    arm.add(box(0.18, 0.65, 0.18, SHIRT, 0, -0.28, 0));
    g.add(arm);
    arms.push(arm);
  }

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.13, 0.9, 0);
    leg.add(box(0.2, 0.9, 0.22, PANTS, 0, -0.45, 0));
    g.add(leg);
    legs.push(leg);
  }

  // Floating nametag
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const tag = new THREE.Sprite(spriteMat);
  tag.scale.set(1.6, 0.4, 1);
  tag.position.y = 2.25;
  g.add(tag);

  return {
    group: g,
    legs,
    arms,
    _walking: false,
    setWalk(moving) {
      this._walking = moving;
    },
  };
}
