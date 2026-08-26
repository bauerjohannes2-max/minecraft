/* ============================================================
   VOXELCRAFT — crafting.js
   Recipe engine:
     - SHAPED recipes: pattern rows matched anywhere in grid
     - SHAPELESS recipes: multiset of ingredients
   - 2x2 pocket grid in inventory panel + 3x3 crafting table
   - Result slot behaves like an inventory slot via InventoryUI
     drop-zone refs (get/set) so drag&drop just works
   ============================================================ */

import { B, ITEMS } from '../config.js';

// resolve helper: name → numeric id (blocks first, then ITEMS)
export function id(name) {
  if (typeof name === 'number') return name;
  if (B[name] !== undefined) return B[name];
  const upper = name.toUpperCase();
  if (B[upper] !== undefined) return B[upper];

  // alias mappings
  if (name === 'coal') return B.COAL_ORE ?? 13;
  if (name === 'wood_pick') return ITEMS.wood_pickaxe?.id ?? 101;
  if (name === 'wood_axe') return ITEMS.wood_axe?.id ?? 102;
  if (name === 'wood_shovel') return ITEMS.wood_shovel?.id ?? 103;
  if (name === 'stone_pick') return ITEMS.stone_pickaxe?.id ?? 105;
  if (name === 'stone_axe') return ITEMS.stone_axe?.id ?? 106;
  if (name === 'stone_shovel') return ITEMS.stone_shovel?.id ?? 107;
  if (name === 'iron_pick') return ITEMS.iron_pickaxe?.id ?? 109;

  return ITEMS[name]?.id ?? null;
}

const TIERS = [
  ['wood',   B.PLANKS],
  ['stone',  B.COBBLE ?? B.STONE],
  ['iron',   B.IRON_ORE],
];

export const RECIPES = [
  // ---------- basics ----------
  { out: { n: 'planks', c: 4 },        shapeless: ['wood_log'] },
  { out: { n: 'stick',  c: 4 },        rows: ['P','P'],            map: { P: 'planks' } },
  { out: { n: 'planks', c: 1 },        rows: ['PP','PP'],          map: { P: 'planks' } },
  { out: { n: 'torch',  c: 4 },        rows: ['C','S'],            map: { C: 'coal', S: 'stick' } },

  // ---------- tools ----------
  ...TIERS.flatMap(([tier, mat]) => mat == null ? [] : [
    { out: { n: tier + '_pick', c: 1 },   rows: ['MMM',' S ',' S '], map: { M: mat, S: 'stick' }, needsTable: true },
    { out: { n: tier + '_axe', c: 1 },    rows: ['MM','MS',' S'],    map: { M: mat, S: 'stick' }, needsTable: true },
    { out: { n: tier + '_shovel', c: 1 }, rows: ['M','S','S'],       map: { M: mat, S: 'stick' }, needsTable: true },
  ]),
];

function gridToIds(grid) {
  return grid.map(s => s ? s.thing : null);
}

export function matchedRecipe(grid, size) {
  const ids = gridToIds(grid);
  const out = { cells: new Set(), result: null };
  const nonEmpty = ids.filter(v => v !== null).length;

  for (const r of RECIPES) {
    if (!r.out) continue;
    if (r.needsTable && size < 3) continue;

    if (r.shapeless) {
      const need = r.shapeless.map(id).sort((a,b)=>a-b);
      const idxs = ids.map((v,i)=>v!==null?i:-1).filter(i=>i>=0)
                      .sort((a,b)=>ids[a]-ids[b]);
      if (idxs.length === need.length &&
          need.every((v,i)=>ids[idxs[i]]===v)) {
        out.result = r.out;
        idxs.forEach(i=>out.cells.add(i));
        return out;
      }
      continue;
    }

    const w = r.rows[0].length, h = r.rows.length;
    if ([...r.rows.join('')].filter(c=>c!==' ').length !== nonEmpty) continue;

    for (let oy = 0; oy + h <= size; oy++) {
      for (let ox = 0; ox + w <= size; ox++) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) {
          for (let x = 0; x < w && ok; x++) {
            const ch = r.rows[y][x];
            const cell = ids[(oy + y) * size + (ox + x)];
            if (ch === ' ') {
              if (cell !== null) ok = false;
            } else {
              if (cell !== id(r.map[ch])) ok = false;
            }
          }
        }
        if (ok) {
          out.result = r.out;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (r.rows[y][x] !== ' ') out.cells.add((oy + y) * size + (ox + x));
            }
          }
          return out;
        }
      }
    }
  }
  return out;
}

export class CraftingUI {
  constructor(inventory, inventoryUI, gridSize = 4) {
    this.inv = inventory;
    this.iui = inventoryUI;
    this.size = Math.round(Math.sqrt(gridSize));
    this.grid = Array.from({ length: gridSize }, () => null);
    this.el = null;
    this.resultStack = null;
    this.usedCells = new Set();
    this.onCrafted = null;

    inventory.onChanged = ((orig) => () => { orig?.(); this.refresh(); })(
      inventory.onChanged);
  }

  mount(panelEl) {
    // remove default placeholder crafting-area if present
    const oldArea = panelEl.querySelector('#crafting-area');
    if (oldArea) oldArea.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'craft-wrap';
    wrap.innerHTML = `
      <div class="craft-label">Crafting ${this.size}×${this.size}</div>
      <div class="craft-row">
        <div class="craft-grid" style="grid-template-columns:repeat(${this.size},46px)"></div>
        <div class="craft-arrow">➜</div>
        <div class="craft-result-slot slot" title="Result"></div>
      </div>`;
    
    // insert right before the inventory-grid
    const invGrid = panelEl.querySelector('#inventory-grid');
    if (invGrid) panelEl.insertBefore(wrap, invGrid);
    else panelEl.prepend(wrap);

    const gEl = wrap.querySelector('.craft-grid');
    this.cellEls = [];
    for (let i = 0; i < this.grid.length; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      this.iui.registerDropZone(d, {
        type: 'craft', index: i,
        get: () => this.grid[i],
        set: (s) => { this.grid[i] = s; this.refresh(); },
      });
      gEl.appendChild(d);
      this.cellEls.push(d);
    }

    const rEl = wrap.querySelector('.craft-result-slot');
    this.resultEl = rEl;
    this.iui.registerDropZone(rEl, {
      type: 'result',
      get: () => this.currentResult(),
      set: () => {},
    });
    rEl.addEventListener('mousedown', () => this.takeResult());
    rEl.addEventListener('contextmenu', e => { e.preventDefault(); this.takeResult(); });

    this.refresh();
  }

  refresh() {
    const match = matchedRecipe(this.grid, this.size);
    this.resultStack = match.result
      ? { thing: id(match.result.n), count: match.result.c ?? 1 }
      : null;
    this.usedCells = match.cells;

    for (let i = 0; i < this.grid.length; i++)
      this.iui._fillSlotEl(this.cellEls?.[i], this.grid[i]);
    this.iui._fillSlotEl(this.resultEl, this.resultStack);

    this.cellEls?.forEach((el, i) => {
      el.style.filter =
        (this.grid[i] && !this.usedCells.has(i)) ? 'brightness(.6)' : '';
    });

    this.iui.renderAll();
  }

  takeResult() {
    if (!this.resultStack) return;
    const stack = { ...this.resultStack };

    if (!this.inv.carried) {
      this.inv.carried = stack;
    } else if (this.inv.carried.thing === stack.thing) {
      const max = this.inv.maxStack(stack.thing);
      if (this.inv.carried.count + stack.count <= max) {
        this.inv.carried.count += stack.count;
      } else {
        return;
      }
    } else {
      return;
    }

    for (let i of this.usedCells) {
      const s = this.grid[i];
      if (s) {
        s.count--;
        if (s.count <= 0) this.grid[i] = null;
      }
    }
    this.onCrafted?.(stack.thing, stack.count);
    this.refresh();
  }

  dumpGridBack() {
    for (let i = 0; i < this.grid.length; i++) {
      const s = this.grid[i];
      if (s) { this.inv.add(s.thing, s.count); this.grid[i] = null; }
    }
    this.refresh();
  }

  currentResult() {
    const m = matchedRecipe(this.grid, this.size);
    return m.result ? { thing: id(m.result.n), count: m.result.c ?? 1 } : null;
  }

  isPocket() { return this.size === 2; }
}
