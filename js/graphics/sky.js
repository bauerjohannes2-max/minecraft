/* ============================================================
   VOXELCRAFT — sky.js
   - timeOfDay: 0..1 (0 = midnight, 0.5 = noon)
   - dayLength real seconds (default 10 min like MC)
   - sun & moon billboards orbit the player
   - star dome fades in at night
   - drives: fog color/distance, ambient & sun intensity,
     background color, and exports isNight() for mob logic
   ============================================================ */

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const DAY_LENGTH = 600;           // seconds per full cycle
const START_TIME = 0.30;          // start mid-morning

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.time = START_TIME;
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.ambient  = new THREE.AmbientLight(0xffffff, 0.55);
    this.hemi     = new THREE.HemisphereLight(0xbfdcff, 0x8a7a5a, 0.5);
    scene.add(this.sunLight, this.ambient, this.hemi);

    // ---------- sun & moon sprites ----------
    const mkDisc = (color, glow) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 6, 32, 32, 32);
      g.addColorStop(0, color);
      g.addColorStop(0.6, glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        fog: false, depthWrite: false, transparent: true,
      }));
      sp.scale.set(60, 60, 1);
      return sp;
    };
    this.sun  = mkDisc('#fff7d0', 'rgba(255,220,120,.6)');
    this.moon = mkDisc('#e8ecf5', 'rgba(180,190,220,.5)');
    scene.add(this.sun, this.moon);

    // ---------- star dome (points on a sphere) ----------
    const starGeo = new THREE.BufferGeometry();
    const N = 400, pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(400);
      pts.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    scene.add(this.stars);

    scene.fog = new THREE.Fog(0x87ceeb, 30, 140);
    this.onTimeChange = null;
  }

  isNight() {
    return this.time < 0.23 || this.time > 0.77;
  }

  update(dt, camera) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const t = this.time;

    // sun angle: rises at 0.25, sets at 0.75
    const angle = (t - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle), sunX = Math.cos(angle);

    const camPos = camera.position;
    this.sun.position.set(
      camPos.x + sunX * 350, camPos.y + sunY * 350, camPos.z - 80);
    this.moon.position.set(
      camPos.x - sunX * 350, camPos.y - sunY * 350, camPos.z + 80);
    this.stars.position.copy(camPos);
    this.stars.rotation.y = t * Math.PI * 2;

    const day = THREE.MathUtils.clamp(sunY * 2.5 + 0.5, 0, 1);
    const duskDawn = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 5, 0, 1);

    if (!this.suppressFog) {
      const skyDay   = new THREE.Color(0x87ceeb);
      const skyNight = new THREE.Color(0x060a1a);
      const skyDusk  = new THREE.Color(0xe8874a);
      const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, duskDawn * 0.55);

      this.scene.background = sky;
      this.scene.fog.color = sky;
      const viewDist = THREE.MathUtils.lerp(60, 140, day);
      this.scene.fog.near = viewDist * 0.35;
      this.scene.fog.far  = viewDist;
    }

    this.sunLight.intensity = 0.15 + day * 0.95;
    this.sunLight.color.setHex(duskDawn > 0.4 ? 0xffb070 : 0xfff4e0);
    this.sunLight.position.set(camPos.x + sunX * 100, Math.max(sunY, 0.05) * 100 + 10, camPos.z + 30);
    this.ambient.intensity = 0.18 + day * 0.42;
    this.hemi.intensity    = 0.12 + day * 0.38;
    this.stars.material.opacity = 1 - day;

    this.onTimeChange?.(t, day);
  }
}
