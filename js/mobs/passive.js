/* ============================================================
   VOXELCRAFT — passive.js
   Sheep & Cow mob classes (subclassing Pig for wander/flee AI)
   ============================================================ */

import { Pig } from './pig.js';

export class Sheep extends Pig {
  constructor(world) {
    super(world);
    this.H = 1.2;
    this.speed = 1.1;
  }
}

export class Cow extends Pig {
  constructor(world) {
    super(world);
    this.H = 1.35;
    this.speed = 1.0;
  }
}
