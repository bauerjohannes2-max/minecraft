/* ============================================================
   VOXELCRAFT — inventory.js
   Data model:
     slot = null | { thing: number, count: number }
   - 36 slots (0-8 hotbar)
   - addToInventory with smart stacking
   - DOM render: hotbar always visible; panel grid with drag&drop
   - "carried" stack follows cursor while dragging
   ============================================================ */

import { BLOCK_IDS, ITEMS, B, thingIsBlock } from '../config.js';
import { tileThumbDataURL } from '../graphics/textures.js';

const STACK_LIMIT_BLOCK = 64;

export class Inventory {
  constructor() {
    this.slots = Array.from({ length: 36 }, () => null);
    this.hotbarSel = 0;
    this.carried = null;             // stack being dragged

    this.onChanged = null;           // re-render hooks
    this._thumbCache = {};
  }

  // ---------------- stacking helpers ----------------
  maxStack(thing) {
    if (thingIsBlock(thing)) return STACK_LIMIT_BLOCK;
    return Object.values(ITEMS).find(i => i.id === thing)?.stack ?? 64;
  }

  labelOf(thing) {
    if (thingIsBlock(thing)) return BLOCK_IDS[thing];
    return Object.keys(ITEMS).find(k => ITEMS[k].id === thing) ?? ('item' + thing);
  }

  thumbOf(thing) {
    if (this._thumbCache[thing]) return this._thumbCache[thing];
    let url;
    if (thingIsBlock(thing)) {
      url = tileThumbDataURL(BLOCK_IDS[thing]);
    } else {
      url = itemThumbURL(thing);
    }
    this._thumbCache[thing] = url;
    return url;
  }

  // ---------------- core operations ----------------

  add(thing, count) {
    const max = this.maxStack(thing);

    // pass 1: top up existing stacks
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.thing === thing && s.count < max) {
        const take = Math.min(max - s.count, count);
        s.count += take;
        count -= take;
      }
    }
    // pass 2: empty slots
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, count);
        this.slots[i] = { thing, count: take };
        count -= take;
      }
    }
    this.onChanged?.();
    return count;
  }

  heldStack() {
    return this.slots[this.hotbarSel];
  }

  consumeHeld(n = 1) {
    const s = this.slots[this.hotbarSel];
    if (!s) return false;
    s.count -= n;
    if (s.count <= 0) this.slots[this.hotbarSel] = null;
    this.onChanged?.();
    return true;
  }

  clearCarriedToInventory() {
    if (!this.carried) return true;
    const left = this.add(this.carried.thing, this.carried.count);
    if (left === 0) { this.carried = null; this.onChanged?.(); return true; }
    this.carried.count = left;
    this.onChanged?.();
    return false;
  }

  serialize() { return JSON.stringify({ slots: this.slots, sel: this.hotbarSel }); }
  deserialize(json) {
    try {
      const d = JSON.parse(json);
      if (Array.isArray(d.slots)) {
        this.slots = d.slots.map(s => s ? { ...s } : null);
        while (this.slots.length < 36) this.slots.push(null);
        this.hotbarSel = d.sel ?? 0;
        this.onChanged?.();
      }
    } catch (e) { console.warn('[inventory] bad save data', e); }
  }
}

function itemThumbURL(id) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  const palette = {
    100: ['#8A6538','#A07A45'],                        // stick
    101: ['#A07A45','#8A6538'], 102: ['#8a8a8a','#a5a5a5'],
    103: ['#D8AF93','#e6cbb4'], 104: ['#A07A45','#8A6538'],
    105: ['#8a8a8a','#a5a5a5'], 106: ['#A07A45','#8A6538'],
    107: ['#8a8a8a','#a5a5a5'], 108: ['#EEEEEE','#ffffff'], // iron_ingot
    110: ['#EBA3A3','#d98f8f'],                        // raw_porkchop
    111: ['#A65B32','#7A3E1D'],                        // cooked_pork
    112: ['#5E733B','#4A5C2D'],                        // rotten_flesh
    113: ['#222222','#444444'],                        // coal
  };
  const [c1, c2] = palette[id] ?? ['#f0f','#fff'];
  ctx.fillStyle = c2; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = c1; ctx.fillRect(2, 2, 12, 12);
  return c.toDataURL();
}

// ============================================================
// DOM controller — renders hotbar & inventory panel, drag/drop
// ============================================================
export class InventoryUI {
  constructor(inventory) {
    this.inv = inventory;
    this.panelOpen = false;
    this.dropZones = [];

    this.inv.onChanged = () => this.renderAll();

    const hb = document.getElementById('hotbar');
    if (hb) hb.innerHTML = '';
    this.hbEls = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.addEventListener('mousedown', () => {
        if (!this.inv.carried) {
          this.inv.hotbarSel = i;
          this.renderAll();
        }
      });
      this._wireDrag(d, { type: 'hotbar', index: i });
      hb?.appendChild(d);
      this.hbEls.push(d);
    }

    const panelHb = document.getElementById('inventory-hotbar');
    if (panelHb) panelHb.innerHTML = '';
    this.panelHbEls = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.addEventListener('mousedown', () => {
        if (!this.inv.carried) {
          this.inv.hotbarSel = i;
          this.renderAll();
        }
      });
      this._wireDrag(d, { type: 'hotbar', index: i });
      panelHb?.appendChild(d);
      this.panelHbEls.push(d);
    }

    const ig = document.getElementById('inventory-grid');
    if (ig) ig.innerHTML = '';
    this.invEls = [];
    for (let i = 0; i < 27; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      this._wireDrag(d, { type: 'inv', index: i });
      ig?.appendChild(d);
      this.invEls.push(d);
    }

    this.carriedEl = document.createElement('div');
    this.carriedEl.className = 'slot';
    Object.assign(this.carriedEl.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: 500,
      display: 'none',
    });
    document.body.appendChild(this.carriedEl);

    document.addEventListener('mousemove', e => {
      if (this.inv.carried) {
        this.carriedEl.style.left = (e.clientX - 23) + 'px';
        this.carriedEl.style.top  = (e.clientY - 23) + 'px';
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.inv.carried) return;
      if (e.target.closest('.slot')) return;
      setTimeout(() => this.inv.clearCarriedToInventory(), 0);
    }, true);

    this.renderAll();
  }

  registerDropZone(el, ref) {
    this._wireDrag(el, ref);
  }

  _wireDrag(el, ref) {
    const getSlot = () => {
      if (ref.get) return ref.get();
      if (ref.type === 'inv') return this.inv.slots[ref.index + 9];
      if (ref.type === 'hotbar') return this.inv.slots[ref.index];
      return this.inv.slots[ref.index];
    };
    const setSlot = (stack) => {
      if (ref.set) {
        ref.set(stack);
      } else {
        const idx = (ref.type === 'inv') ? ref.index + 9 : ref.index;
        this.inv.slots[idx] = stack;
      }
    };

    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const inv = this.inv;
      const src = getSlot();

      if (inv.carried) {
        if (!src) {
          setSlot(inv.carried);
          inv.carried = null;
        } else if (src.thing === inv.carried.thing) {
          const max = inv.maxStack(src.thing);
          const take = Math.min(max - src.count, inv.carried.count);
          src.count += take;
          inv.carried.count -= take;
          if (inv.carried.count <= 0) inv.carried = null;
        } else {
          const tmp = { ...src };
          setSlot({ ...inv.carried });
          inv.carried = tmp;
        }
      } else if (src) {
        inv.carried = { ...src };
        setSlot(null);
      }
      inv.onChanged?.();
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const inv = this.inv;
      const cur = getSlot();

      if (inv.carried) {
        if (!cur) {
          setSlot({ thing: inv.carried.thing, count: 1 });
          inv.carried.count--;
        } else if (cur.thing === inv.carried.thing && cur.count < inv.maxStack(cur.thing)) {
          cur.count++;
          inv.carried.count--;
        }
        if (inv.carried.count <= 0) inv.carried = null;
      } else if (cur && cur.count > 1) {
        const half = Math.ceil(cur.count / 2);
        inv.carried = { thing: cur.thing, count: half };
        cur.count -= half;
      } else if (cur) {
        inv.carried = { ...cur };
        setSlot(null);
      }
      inv.onChanged?.();
    });
  }

  _fillSlotEl(el, stack, active = false) {
    if (!el) return;
    el.className = 'slot' + (active ? ' active' : '');
    el.innerHTML = '';
    if (!stack) {
      el.onmouseenter = null;
      el.onmouseleave = null;
      return;
    }
    const img = document.createElement('img');
    img.src = this.inv.thumbOf(stack.thing);
    img.width = img.height = 32;
    img.style.imageRendering = 'pixelated';
    el.appendChild(img);
    if (stack.count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = stack.count;
      el.appendChild(c);
    }
    el.onmouseenter = () => this.showTooltip(el, stack);
    el.onmouseleave = () => this.hideTooltip();
  }

  showTooltip(el, stack) {
    this.hideTooltip();
    if (!stack) return;
    const d = document.createElement('div');
    d.className = 'tooltip';
    const label = this.inv.labelOf(stack.thing);
    const def = Object.values(ITEMS).find(i => i.id === stack.thing);
    d.innerHTML = `<b>${def?.name || label}</b>` +
      (def?.food ? `<span class="tip-sub">🍖 restores ${def.food} hunger</span>` : '') +
      (def?.tool ? `<span class="tip-sub">⛏️ ${def.tool} · speed ×${def.speed}</span>` : '');
    document.body.appendChild(d);
    const r = el.getBoundingClientRect();
    d.style.left = (r.right + 8) + 'px';
    d.style.top = r.top + 'px';
    this._tooltip = d;
  }

  hideTooltip() {
    this._tooltip?.remove();
    this._tooltip = null;
  }

  renderAll() {
    for (let i = 0; i < 9; i++) {
      this._fillSlotEl(this.hbEls[i], this.inv.slots[i], i === this.inv.hotbarSel);
      if (this.panelHbEls && this.panelHbEls[i]) {
        this._fillSlotEl(this.panelHbEls[i], this.inv.slots[i], i === this.inv.hotbarSel);
      }
    }

    for (let i = 0; i < 27; i++) {
      if (!this.panelOpen) continue;
      if (this.invEls && this.invEls[i]) {
        this._fillSlotEl(this.invEls[i], this.inv.slots[i + 9]);
      }
    }

    const c = this.inv.carried;
    if (c) {
      this.carriedEl.style.display = '';
      this._fillSlotEl(this.carriedEl, c);
    } else {
      this.carriedEl.style.display = 'none';
    }
  }

  openPanel(open) {
    this.panelOpen = open;
    document.getElementById('inventory-panel').classList.toggle('hidden', !open);
    if (open) this.renderAll();
    else if (this.inv.carried) this.inv.clearCarriedToInventory();
  }
}
