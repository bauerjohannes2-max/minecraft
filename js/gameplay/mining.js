/* ============================================================
   VOXELCRAFT — mining.js
   Hold left-click to break blocks:
   - Time based on block hardness ÷ tool speed (proper tool 3x+)
   - Crack overlay stages scale on the targeted block
   - Spawns drops (drops.js in Part 13) via callback
   ============================================================ */

import * as THREE from 'three';
import { BLOCK_IDS, BLOCKS, ITEMS, B } from '../config.js';
import { raycastVoxel } from './raycast.js';

export class MiningSystem {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;

    this.target = null;          // current raycast result
    this.progress = 0;           // 0..1 break animation
    this.breakTime = 0;          // seconds total needed

    // ---- selection outline (black wireframe cube like MC) ----
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    this.outline.visible = false;
    scene.add(this.outline);

    // ---- crack overlay: expanding dark shell whose opacity grows ----
    const crackGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.crack = new THREE.Mesh(
      crackGeo,
      new THREE.MeshBasicMaterial({
        color: 0x111111, transparent: true, opacity: 0,
        depthWrite: false,
      })
    );
    this.crack.visible = false;
    scene.add(this.crack);

    this.onBlockBroken = null;   // (blockType, x,y,z) set by main.js → spawns drop
    this.onBreakStart = null;    // sound hook
    this.onBreakDone = null;
  }

  update(dt, player, camera, controls, heldThing) {
    if (!controls.locked || controls.uiOpen) {
      this.target = null;
      this.outline.visible = false;
      this.crack.visible = false;
      return;
    }

    // ---------- find target ----------
    const eye = player.getEyePosition(new THREE.Vector3());
    const forward = camera.getForward(new THREE.Vector3());
    const REACH = 5;

    this.target = raycastVoxel(this.world, eye, forward, REACH);

    if (!this.target.hit || this.target.y < 1 /* bedrock protect */) {
      this.outline.visible = false;
      this._stopBreaking();
      return;
    }

    // move outline to hit block
    const t = this.target;
    this.outline.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    this.outline.visible = true;

    // ---------- breaking ----------
    if (controls.attackHeld) {
      // changed target? reset progress
      const sameBlock = this._lastKey === `${t.x},${t.y},${t.z}`;
      if (!sameBlock) this._stopBreaking();

      if (this.progress === 0) {
        this.breakTime = this.calcBreakTime(t.block, heldThing);
        this.onBreakStart?.(t.block);
      }

      this.progress += dt / this.breakTime;
      this._lastKey = `${t.x},${t.y},${t.z}`;

      // animate crack shell
      this.crack.visible = true;
      this.crack.position.copy(this.outline.position);
      const p = Math.min(1, this.progress);
      this.crack.material.opacity = p * 0.55;
      const s = 1 + Math.sin(p * Math.PI) * 0.06;
      this.crack.scale.set(s, s, s);

      if (this.progress >= 1) {
        this._breakBlock(t);
        this._stopBreaking();
      }
    } else {
      this._stopBreaking();
    }
  }

  _stopBreaking() {
    this.progress = 0;
    this.crack.visible = false;
    this.crack.material.opacity = 0;
    this._lastKey = null;
  }

  calcBreakTime(blockType, heldThing) {
    const def = BLOCKS[BLOCK_IDS[blockType]];
    if (!def || def.hard < 0) return Infinity;

    let speed = 1;
    if (heldThing >= 100) {
      const item = Object.values(ITEMS).find(i => i.id === heldThing);
      if (item?.tool && item.tool === def.tool) speed = item.speed;
    }
    return def.hard / speed;
  }

  _breakBlock(t) {
    const old = this.world.getBlock(t.x, t.y, t.z);
    const above = this.world.getBlock(t.x, t.y + 1, t.z);
    if ([B.FLOWER, B.TALLGRASS].includes(above)) {
      this.world.setBlock(t.x, t.y + 1, t.z, B.AIR);
    }
    this.world.setBlock(t.x, t.y, t.z, B.AIR);
    this.onBreakDone?.(old);
    this.onBlockBroken?.(old, t.x, t.y, t.z);
  }
}
