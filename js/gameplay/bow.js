/* ============================================================
   VOXELCRAFT — bow.js
   - Hold RMB with bow: draw power (up to 1.0s)
   - Release: fire gravity-arced projectile arrow
   - Sticks into terrain, hits and damages mobs with knockback
   - Consumes 1 arrow per shot from player inventory
   ============================================================ */

import * as THREE from 'three';
import { B, ITEMS } from '../config.js';
import { G } from '../main.js';

const MAX_DRAW = 1.0;
const SPEED_MAX = 34;

export class BowSystem {
  constructor(scene) {
    this.scene = scene;
    this.arrows = []; // {mesh, vel, life, stuck, stuckTimer}
    this.draw = 0;
    this._active = false;
    this.hit = false;
  }

  update(dt, controls, player) {
    // ---------- drawing ----------
    const held = G.inventory?.heldStack();
    const drawing =
      controls?.locked && !controls?.uiOpen && controls?.useHeld &&
      held?.thing === ITEMS.bow?.id &&
      this.hasArrow();

    if (drawing && !controls?.uiOpen) {
      this.draw = Math.min(MAX_DRAW, this.draw + dt);
      this._active = true;
      G.hud?.drawBar?.(this.draw / MAX_DRAW);
    } else {
      if (this._active && this.draw > 0.15 && !drawing) {
        this.fire(player);
      }
      if (!drawing) {
        this.draw = 0;
        this._active = false;
        G.hud?.drawBar?.(-1);
      }
    }

    // ---------- flight & physics ----------
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;

      if (!a.stuck) {
        a.vel.y -= 20 * dt; // gravity arc
        const step = a.vel.clone().multiplyScalar(dt);

        // mob collision test
        if (G.mobs) {
          for (const m of G.mobs.mobs) {
            if (m.dead) continue;
            const center = m.pos.clone().add(new THREE.Vector3(0, m.H * 0.55, 0));
            const toC = center.clone().sub(a.mesh.position);
            const dir = a.vel.clone().normalize();
            const along = toC.dot(dir);

            if (along < 0 || along > step.length() + 0.8) continue;
            const closestDist = toC.sub(dir.clone().multiplyScalar(along)).length();

            if (closestDist < m.W + 0.5) {
              const dmg = Math.round((a.charge ?? 1) * 7 + 3);
              m.hurt(dmg, {
                x: a.mesh.position.x - a.vel.x * 0.1,
                z: a.mesh.position.z - a.vel.z * 0.1,
              });
              this.removeArrow(i);
              this.hit = true;
              break;
            }
          }
        }
        if (this.hit) {
          this.hit = false;
          continue;
        }

        a.mesh.position.add(step);

        // orient along arc velocity
        if (a.vel.lengthSq() > 0.1) {
          a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
        }

        // block collision check
        const px = a.mesh.position;
        const block = G.world?.getBlock(
          Math.floor(px.x), Math.floor(px.y), Math.floor(px.z)
        );

        if (block !== B.AIR && block !== B.WATER) {
          a.stuck = true;
          a.stuckTimer = 8.0;
        }
      } else {
        a.stuckTimer -= dt;
        if (a.stuckTimer <= 0) {
          this.removeArrow(i);
          continue;
        }
      }

      if (a.life <= 0 || a.mesh.position.y < -15) {
        this.removeArrow(i);
      }
    }
  }

  hasArrow() {
    return G.inventory?.slots.some(
      s => s && s.thing === ITEMS.arrow?.id && s.count > 0
    );
  }

  fire(player) {
    if (!G.inventory) return;

    // consume 1 arrow
    const idx = G.inventory.slots.findIndex(
      s => s?.thing === ITEMS.arrow?.id
    );
    if (idx < 0) return;

    G.inventory.slots[idx].count--;
    if (G.inventory.slots[idx].count <= 0) G.inventory.slots[idx] = null;
    G.inventory.onChanged?.();
    G.inventoryUI?.renderAll?.();

    const eye = player.getEyePosition(new THREE.Vector3());
    const fwd = G.fpsCam.getForward(new THREE.Vector3());

    const chargeRatio = this.draw / MAX_DRAW;
    const speed = SPEED_MAX * (0.35 + 0.65 * chargeRatio);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.65),
      new THREE.MeshLambertMaterial({ color: 0xc8aa78 })
    );
    mesh.position.copy(eye).addScaledVector(fwd, 0.6);
    this.scene.add(mesh);

    this.arrows.push({
      mesh,
      vel: fwd.clone().multiplyScalar(speed),
      life: 14,
      stuck: false,
      charge: chargeRatio,
    });

    mesh.lookAt(mesh.position.clone().add(fwd));

    this.draw = 0;
    this._active = false;
    G.hud?.drawBar?.(-1);
  }

  removeArrow(i) {
    const a = this.arrows[i];
    if (!a) return;
    this.scene.remove(a.mesh);
    a.mesh.geometry?.dispose();
    a.mesh.material?.dispose();
    this.arrows.splice(i, 1);
  }
}
