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
  if (name === null || name === undefined) return null;
  if (typeof name === 'number') return name;
  if (B[name] !== undefined) return B[name];
  const upper = name.toUpperCase();
  if (B[upper] !== undefined) return B[upper];

  // alias mappings
  if (name === 'coal') return ITEMS.coal?.id ?? 113;
  if (name === 'coal_ore') return B.COAL_ORE ?? 13;
  if (name === 'wood_log' || name === 'log') return B.WOOD_LOG;
  if (name === 'planks') return B.PLANKS;
  if (name === 'cobble') return B.COBBLE;
  if (name === 'stone') return B.STONE;
  if (name === 'sand') return B.SAND;
  if (name === 'stick') return ITEMS.stick?.id ?? 100;
  if (name === 'iron_ingot') return ITEMS.iron_ingot?.id ?? 108;
  if (name === 'wood_pick') return ITEMS.wood_pick?.id ?? 101;
  if (name === 'stone_pick') return ITEMS.stone_pick?.id ?? 102;
  if (name === 'iron_pick') return ITEMS.iron_pick?.id ?? 103;
  if (name === 'wood_axe') return ITEMS.wood_axe?.id ?? 104;
  if (name === 'stone_axe') return ITEMS.stone_axe?.id ?? 105;
  if (name === 'wood_shovel') return ITEMS.wood_shovel?.id ?? 106;
  if (name === 'stone_shovel') return ITEMS.stone_shovel?.id ?? 107;
  if (name === 'wood_hoe') return ITEMS.wood_hoe?.id ?? 114;
  if (name === 'stone_hoe') return ITEMS.stone_hoe?.id ?? 115;
  if (name === 'wheat') return ITEMS.wheat?.id ?? 117;
  if (name === 'bread') return ITEMS.bread?.id ?? 118;
  if (name === 'leather') return ITEMS.leather?.id ?? 122;
  if (name === 'gunpowder') return ITEMS.gunpowder?.id ?? 123;
  if (name === 'wood_sword') return ITEMS.wood_sword?.id ?? 130;
  if (name === 'stone_sword') return ITEMS.stone_sword?.id ?? 131;
  if (name === 'iron_sword') return ITEMS.iron_sword?.id ?? 132;
  if (name === 'leather_helmet') return ITEMS.leather_helmet?.id ?? 133;
  if (name === 'leather_tunic') return ITEMS.leather_tunic?.id ?? 134;
  if (name === 'iron_helmet') return ITEMS.iron_helmet?.id ?? 135;
  if (name === 'iron_chest') return ITEMS.iron_chest?.id ?? 136;
  if (name === 'bow') return ITEMS.bow?.id ?? 140;
  if (name === 'arrow') return ITEMS.arrow?.id ?? 141;
  if (name === 'feather') return ITEMS.feather?.id ?? 142;
  if (name === 'stringy' || name === 'string') return ITEMS.stringy?.id ?? 143;
  if (name === 'torch') return B.TORCH;
  if (name === 'tnt' || name === 'TNT') return B.TNT;

  return ITEMS[name]?.id ?? null;
}

export const RECIPES = [
  // ---------- basics ----------
  { out: { n: 'planks', c: 4 },        shapeless: ['wood_log'] },
  { out: { n: 'stick',  c: 4 },        rows: ['P','P'],            map: { P: 'planks' } },
  { out: { n: 'torch',  c: 4 },        rows: ['C','S'],            map: { C: 'coal', S: 'stick' } },
  { out: { n: 'torch',  c: 4 },        rows: ['C','S'],            map: { C: 'coal_ore', S: 'stick' } },

  // ---------- tools ----------
  // picks: 3 material top, stick column
  { out: { n: 'wood_pick', c: 1 },     rows: ['MMM',' S ',' S '],  map: { M: 'planks', S: 'stick' }, needsTable: true },
  { out: { n: 'stone_pick', c: 1 },    rows: ['MMM',' S ',' S '],  map: { M: 'cobble', S: 'stick' }, needsTable: true },
  { out: { n: 'iron_pick', c: 1 },     rows: ['MMM',' S ',' S '],  map: { M: 'iron_ingot', S: 'stick' }, needsTable: true },

  // axes: 2x2 blade + stick column
  { out: { n: 'wood_axe', c: 1 },      rows: ['MM','MS',' S'],     map: { M: 'planks', S: 'stick' }, needsTable: true },
  { out: { n: 'stone_axe', c: 1 },     rows: ['MM','MS',' S'],     map: { M: 'cobble', S: 'stick' }, needsTable: true },

  // shovels: 1 material + stick column
  { out: { n: 'wood_shovel', c: 1 },   rows: ['M','S','S'],        map: { M: 'planks', S: 'stick' }, needsTable: true },
  { out: { n: 'stone_shovel', c: 1 },  rows: ['M','S','S'],        map: { M: 'cobble', S: 'stick' }, needsTable: true },

  // hoes: 2 material top + stick column
  { out: { n: 'wood_hoe', c: 1 },      rows: ['MM',' S',' S'],     map: { M: 'planks', S: 'stick' }, needsTable: true },
  { out: { n: 'stone_hoe', c: 1 },     rows: ['MM',' S',' S'],     map: { M: 'cobble', S: 'stick' }, needsTable: true },

  // swords: 2 material column + 1 stick
  { out: { n: 'wood_sword', c: 1 },    rows: ['M','M','S'],        map: { M: 'planks', S: 'stick' }, needsTable: true },
  { out: { n: 'stone_sword', c: 1 },   rows: ['M','M','S'],        map: { M: 'cobble', S: 'stick' }, needsTable: true },
  { out: { n: 'iron_sword', c: 1 },    rows: ['M','M','S'],        map: { M: 'iron_ingot', S: 'stick' }, needsTable: true },

  // weapons & armor & utility
  { out: { n: 'bow', c: 1 },           rows: [' SI','S I',' SI'],  map: { S: 'stick', I: 'stringy' }, needsTable: true },
  { out: { n: 'arrow', c: 4 },         rows: ['S','E'],            map: { S: 'stick', E: 'feather' } },
  { out: { n: 'bread', c: 1 },         rows: ['WWW'],              map: { W: 'wheat' } },
  { out: { n: 'tnt', c: 1 },           rows: ['GSG','SGS','GSG'],  map: { G: 'gunpowder', S: 'sand' }, needsTable: true },

  { out: { n: 'leather_helmet', c: 1 }, rows: ['LLL','L L'],      map: { L: 'leather' }, needsTable: true },
  { out: { n: 'leather_tunic', c: 1 },  rows: ['L L','LLL','LLL'], map: { L: 'leather' }, needsTable: true },
  { out: { n: 'iron_helmet', c: 1 },    rows: ['III','I I'],       map: { I: 'iron_ingot' }, needsTable: true },
  { out: { n: 'iron_chest', c: 1 },     rows: ['I I','III','III'], map: { I: 'iron_ingot' }, needsTable: true },
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
