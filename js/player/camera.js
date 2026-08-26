/* ============================================================
   VOXELCRAFT — camera.js
   First-person camera: yaw/pitch handling with clamping,
   eye-height offset, sneaking offset, and subtle view bob.
   ============================================================ */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const PITCH_LIMIT = Math.PI / 2 - 0.001;

export class FPSCamera {
  constructor(aspect = innerWidth / innerHeight) {
    this.camera = new THREE.PerspectiveCamera(
      75, aspect, 0.08, CONFIG.RENDER_DISTANCE * CONFIG.CHUNK_SIZE * 1.8
    );

    this.yaw   = 0;              // rotation around Y (radians)
    this.pitch = 0;              // up/down (radians)

    this.bobPhase = 0;
    this.bobAmount = 0;          // eased toward target based on movement
  }

  applyLook(dx, dy) {
    this.yaw   -= dx;
    this.pitch -= dy;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  // position = player feet position vector (THREE.Vector3 or {x,y,z})
  // opts: { sneaking, swimming, moving, dt, onGround, sprinting }
  update(playerPos, opts = {}) {
    const cam = this.camera;

    // --- eye height ---
    let eyeY = CONFIG.PLAYER_EYE_HEIGHT;                    // 1.62
    if (opts.sneaking) eyeY -= 0.25;

    // --- view bob ---
    const bobTarget = (opts.moving && opts.onGround) ? 1 : 0;
    this.bobAmount += (bobTarget - this.bobAmount) * Math.min(1, (opts.dt || 0.016) * 10);
    this.bobPhase  += (opts.dt || 0.016) * (opts.sprinting ? 13 : 9);
    const bobX = Math.cos(this.bobPhase * 0.5) * 0.05 * this.bobAmount;
    const bobY = Math.abs(Math.sin(this.bobPhase))   * 0.06 * this.bobAmount;

    cam.position.set(
      playerPos.x + bobX * Math.cos(this.yaw),
      playerPos.y + eyeY + bobY,
      playerPos.z - bobX * Math.sin(this.yaw)
    );

    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // direction the crosshair points (unit vector)
  getForward(target = new THREE.Vector3()) {
    return target.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
