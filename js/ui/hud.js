/* ============================================================
   VOXELCRAFT — hud.js
   Survival HUD: hearts, hunger drumsticks, damage flash,
   low-health pulse, and food-triggered regeneration.
   Works off Player.health / Player.hunger (see config caps).
   ============================================================ */

import { CONFIG } from '../config.js';

const HEARTS = 10;   // 10 hearts = 20 hp
const SHANKS = 10;   // 10 shanks = 20 hunger

export const G_SHAKE = {
  x: 0,
  y: 0,
  z: 0,
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
};

export class HUD {
  constructor(player, inventory) {
    this.player = player;
    this.inv = inventory;

    this.heartsEl  = document.getElementById('hearts');
    this.hungerEl  = document.getElementById('hunger');
    this.flashEl   = document.getElementById('damage-flash');

    this.lastHP   = player.health;
    this.lastHQ   = player.hunger * 2;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.shake = 0;

    this._build();
    this.render();

    player.onDamaged = () => this.damageFlash();
  }

  _build() {
    const heartSVG = `<svg viewBox="0 0 16 16" width="22" height="22"><path d="M8 14 2.5 8.6a3.4 3.4 0 0 1 0-4.9 3.4 3.4 0 0 1 4.9 0L8 4.2l.6-.5a3.4 3.4 0 0 1 4.9 0 3.4 3.4 0 0 1 0 4.9Z" fill="#e33" stroke="#300" stroke-width="1"/></svg>`;
    const shankSVG = `<svg viewBox="0 0 16 16" width="22" height="22"><path d="M3 13c-1-1-1-2.5 0-3.5L9 4l1.5-1.5c1-1 2.5-1 3.5 0s1 2.5 0 3.5L12.5 7.5 7 13c-1 1-3 1-4 0Z" fill="#b5651d" stroke="#4d2400" stroke-width="1"/><circle cx="11" cy="5" r="1.4" fill="#f4e4bc"/></svg>`;

    if (this.heartsEl) this._fillRow(this.heartsEl, HEARTS, heartSVG);
    if (this.hungerEl) this._fillRow(this.hungerEl, SHANKS, shankSVG);
  }

  _fillRow(rowEl, n, svg) {
    rowEl.innerHTML = '';
    this['_cells_' + rowEl.id] = [];
    for (let i = 0; i < n; i++) {
      const span = document.createElement('span');
      span.className = 'pip';
      span.innerHTML = svg;
      rowEl.appendChild(span);
      this['_cells_' + rowEl.id].push(span);
    }
  }

  render() {
    const p = this.player;
    const drawPips = (rowId, value, max) => {
      const cells = this['_cells_' + rowId];
      if (!cells) return;
      for (let i = 0; i < cells.length; i++) {
        const pts = value - i * 2;
        cells[i].style.opacity = pts >= 2 ? '1' : pts > 0 ? '0.45' : '0.15';
        cells[i].classList.toggle('low', value <= 4);
      }
    };
    drawPips('hearts', Math.ceil(p.health), CONFIG.MAX_HEALTH);
    drawPips('hunger', Math.ceil(p.hunger), CONFIG.MAX_HUNGER);

    document.body.classList.toggle('critical-hp', p.health <= 4 && p.health > 0);
  }

  damageFlash() {
    if (!this.flashEl) return;
    this.flashEl.classList.remove('active');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('active');
    this.shake = 0.35;
  }

  update(dt) {
    const p = this.player;

    // ---- hunger drain ----
    const sprinting = p.onGround && Math.hypot(p.vel.x, p.vel.z) > CONFIG.PLAYER_WALK_SPEED * 1.05;
    let drain = dt * 0.06;
    if (sprinting) drain += dt * 0.30;
    if (p.inWater)  drain += dt * 0.05;
    p.hunger = Math.max(0, p.hunger - drain);

    // ---- starvation ----
    if (p.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 3) {
        this.starveTimer = 0;
        p.damage(1);
      }
    } else {
      this.starveTimer = 0;
    }

    // ---- natural regen ----
    if (p.hunger >= 16 && p.health < CONFIG.MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.5) {
        this.regenTimer = 0;
        p.heal(1);
        p.hunger = Math.max(0, p.hunger - 0.4);
      }
    } else {
      this.regenTimer = 0;
    }

    // ---- camera shake ----
    if (this.shake > 0) {
      this.shake -= dt;
      const s = this.shake * 0.25;
      G_SHAKE.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    } else {
      G_SHAKE.set(0, 0, 0);
    }

    if (p.health !== this.lastHP || Math.floor(p.hunger * 2) !== Math.floor(this.lastHQ ?? -1)) {
      this.lastHP = p.health;
      this.lastHQ = p.hunger * 2;
      this.render();
    }
  }
}
