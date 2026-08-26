/* ============================================================
   VOXELCRAFT — eating.js
   Right-click held food when hungry:
   - brief eat delay with screen feedback, then restore hunger
   - rotten flesh may poison you (drains hearts over time)
   ============================================================ */

import { ITEMS } from '../config.js';

const EAT_TIME = 1.2;

export class EatingSystem {
  constructor(player, inventory, hud) {
    this.player = player;
    this.inv = inventory;
    this.hud = hud;
    this.progress = 0;
    this.latch = false;
    this._lastChomp = -1;

    this.poisonEl = document.createElement('div');
    this.poisonEl.id = 'poison-overlay';
    document.getElementById('ui-layer')?.appendChild(this.poisonEl);
    this.poisonTimer = 0;
    this.poisonTick = 0;
    this.chompCallback = null;
    this.onEaten = null;
    this.onPoison = null;
  }

  update(dt, controls) {
    // ---------- poison ticking ----------
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      this.poisonEl.classList.add('active');
      this.poisonTick -= dt;
      if (this.poisonTick <= 0) {
        this.poisonTick = 2;
        this.player.damage(1);
      }
      if (this.poisonTimer <= 0) this.poisonEl.classList.remove('active');
    }

    const stack = this.inv.heldStack();
    const def = stack && stack.thing >= 100
      ? Object.values(ITEMS).find(i => i.id === stack.thing) : null;

    if (!def?.food || this.player.hunger >= 20 || !controls.locked ||
        controls.uiOpen || !controls.useHeld) {
      this.progress = 0;
      this.latch = false;
      return;
    }
    if (this.latch) return;

    // ---------- chomp animation ----------
    this.progress += dt / EAT_TIME;

    if ((this.progress * 4 | 0) !== (this._lastChomp ?? -1)) {
      this._lastChomp = this.progress * 4 | 0;
      this.chompCallback?.();
    }

    if (this.progress >= 1) {
      this._finish(def);
      this.progress = 0;
      this.latch = true;
    }
  }

  _finish(def) {
    this.inv.consumeHeld(1);
    this.player.hunger = Math.min(20, this.player.hunger + def.food);
    this.onEaten?.(def);
    if (Math.random() < (def.poisonChance ?? 0)) {
      this.poisonTimer = 6;
      this.onPoison?.();
    }
  }
}
