/* ============================================================
   VOXELCRAFT — blockui.js
   Opens/closes context panels anchored above inventory:
   - #table-panel  : full 3x3 CraftingUI grid
   - #furnace-panel: input/fuel/output + burn & progress bars
   ============================================================ */

import { B } from '../config.js';
import { CraftingUI } from '../gameplay/crafting.js';

export class BlockUI {
  constructor(inventory, inventoryUI, containers) {
    this.inv = inventory;
    this.iui = inventoryUI;
    this.containers = containers;

    this.tableCraft = new CraftingUI(inventory, inventoryUI, 9);
    const tablePanel = document.getElementById('table-panel');
    if (tablePanel) this.tableCraft.mount(tablePanel);
    this.openedFurnaceKey = null;
    this._wired = false;

    containers.onFurnaceChanged = () => this.renderFurnace();
  }

  isOpen() {
    const table = document.getElementById('table-panel');
    const furn = document.getElementById('furnace-panel');
    return (table && !table.classList.contains('hidden')) ||
           (furn && !furn.classList.contains('hidden'));
  }

  closeAll() {
    this.tablePanelOpen(false);
    this.furnacePanelOpen(false);
  }

  openFor(blockType, x, y, z) {
    if (blockType === B.CRAFTING_TABLE) {
      this.tablePanelOpen(true);
      return true;
    }
    if (blockType === B.FURNACE) {
      this.openedFurnaceKey = `${x},${y},${z}`;
      this.wireFurnaceZones(x, y, z);
      this.furnacePanelOpen(true);
      return true;
    }
    return false;
  }

  tablePanelOpen(open) {
    const el = document.getElementById('table-panel');
    if (!el) return;
    el.classList.toggle('hidden', !open);
    if (!open) this.tableCraft.dumpGridBack();
    else this.tableCraft.refresh();
  }

  wireFurnaceZones(x, y, z) {
    const s = this.containers.slotsOf(x, y, z);
    if (!s) return;
    if (!this._wired) {
      this._wired = true;
      const inp = document.getElementById('furn-input');
      const fue = document.getElementById('furn-fuel');
      const outEl = document.getElementById('furn-output');

      if (inp) this.iui.registerDropZone(inp, { type: 'furn_in', get: () => this.currentFurn()?.input, set: (st) => { const c = this.currentFurn(); if(c) c.input = st; } });
      if (fue) this.iui.registerDropZone(fue, { type: 'furn_fuel', get: () => this.currentFurn()?.fuel, set: (st) => { const c = this.currentFurn(); if(c) c.fuel = st; } });
      if (outEl) {
        this.iui.registerDropZone(outEl, {
          type: 'result',
          get: () => this.currentFurn()?.output,
          set: () => {},
        });
        outEl.addEventListener('mousedown', () => {
          const c = this.currentFurn();
          if (c?.output && !this.inv.carried) {
            this.inv.carried = { ...c.output };
            c.output = null;
            this.inv.onChanged?.();
          } else if (c?.output && this.inv.carried?.thing === c.output.thing) {
            this.inv.carried.count += c.output.count;
            c.output = null;
            this.inv.onChanged?.();
          }
        });
      }
    }
    this.renderFurnace();
  }

  currentFurn() {
    if (!this.openedFurnaceKey) return null;
    const [x, y, z] = this.openedFurnaceKey.split(',').map(Number);
    return this.containers.get(x, y, z);
  }

  renderFurnace() {
    const panel = document.getElementById('furnace-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    const c = this.currentFurn();
    if (!c) return;

    this.iui._fillSlotEl(document.getElementById('furn-input'),  c.input);
    this.iui._fillSlotEl(document.getElementById('furn-fuel'),   c.fuel);
    this.iui._fillSlotEl(document.getElementById('furn-output'), c.output);

    const flame = document.getElementById('furn-flame');
    if (flame) {
      flame.style.height = (c.burnMax ? (c.burnTime / c.burnMax) * 100 : 0) + '%';
    }
    const prog = document.getElementById('furn-progress');
    if (prog) {
      prog.style.width = ((c.cookTime / 10) * 100) + '%';
    }
  }

  furnacePanelOpen(open) {
    const el = document.getElementById('furnace-panel');
    if (el) el.classList.toggle('hidden', !open);
    if (open) this.renderFurnace();
  }

  tick(dt) {
    const panel = document.getElementById('furnace-panel');
    if (panel && !panel.classList.contains('hidden')) {
      this.renderFurnace();
    }
  }
}
