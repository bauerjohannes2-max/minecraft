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
