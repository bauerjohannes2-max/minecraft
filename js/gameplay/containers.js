/* ============================================================
   VOXELCRAFT — containers.js
   Registry of interactive blocks by world position:
   - crafting tables are stateless (UI only)
   - furnaces hold { input, fuel, output, burnTime, cookTime }
     and smelt continuously via update()
   ============================================================ */

import * as THREE from 'three';
import { B, ITEMS, BLOCK_IDS } from '../config.js';

function idOf(nameOrId) {
  if (typeof nameOrId === 'number') return nameOrId;
  if (ITEMS[nameOrId]) return ITEMS[nameOrId].id;
  if (B[nameOrId] !== undefined) return B[nameOrId];
  const u = nameOrId.toUpperCase();
  if (B[u] !== undefined) return B[u];
  return nameOrId;
}

function nameOf(idNum) {
  if (idNum >= 100)
    return Object.keys(ITEMS).find(k => ITEMS[k].id === idNum);
  return BLOCK_IDS[idNum];
}

const SMELT_RECIPES = [
  { in: B.IRON_ORE,      out: 108 /* iron_ingot */,  qty: 1 },
  { in: B.SAND,          out: B.GLASS,               qty: 1 },
  { in: B.COBBLE,        out: B.STONE,               qty: 1 },
  { in: 110 /*raw_pork*/,out: 111 /*cooked_pork*/,   qty: 1 },
  { in: 119 /*raw_beef*/,out: 120 /*steak*/,         qty: 1 },
];

const FUELS = {
  coal: 80,
  coal_ore: 80,
  113: 80,
  wood_log: 15,
  planks: 7.5,
  stick: 2.5,
  100: 2.5,
};

export class Containers {
  constructor(world) {
    this.world = world;
    this.map = new Map();
    this.onFurnaceChanged = null;
  }

  key(x, y, z) { return `${x},${y},${z}`; }

  onBlockPlaced(type, x, y, z) {
    if (type === B.FURNACE) {
      this.map.set(this.key(x, y, z), {
        type: 'furnace',
        input: null, fuel: null, output: null,
        burnTime: 0, burnMax: 0, cookTime: 0,
        pos: { x, y, z },
      });
    }
  }

  onBlockRemoved(x, y, z) {
    const k = this.key(x, y, z);
    const c = this.map.get(k);
    if (c) {
      for (const slot of [c.input, c.fuel, c.output]) {
        if (slot) this.world.spillDrops?.(slot.thing, slot.count, x, y, z);
      }
      this.map.delete(k);
    }
  }

  get(x, y, z) { return this.map.get(this.key(x, y, z)); }

  update(dt) {
    for (const c of this.map.values()) {
      if (c.type !== 'furnace') continue;
      let changed = false;

      const recipe = c.input && SMELT_RECIPES.find(r => r.in === c.input.thing);

      const outId = recipe ? idOf(recipe.out) : null;
      const canSmelt = recipe &&
        (!c.output || (c.output.thing === outId && c.output.count < 64));

      if (c.burnTime <= 0 && canSmelt && c.fuel) {
        const fuelName = nameOf(c.fuel.thing);
        const f = FUELS[fuelName] || (c.fuel.thing === B.COAL_ORE ? 80 : (c.fuel.thing === B.WOOD_LOG ? 15 : (c.fuel.thing === B.PLANKS ? 7.5 : 2.5)));
        if (f) {
          c.burnTime = f;
          c.burnMax = f;
          c.fuel.count--;
          if (c.fuel.count <= 0) c.fuel = null;
          changed = true;
        }
      }

      if (c.burnTime > 0) {
        c.burnTime -= dt;
        if (canSmelt) {
          c.cookTime += dt;
          if (c.cookTime >= 10) {
            c.cookTime = 0;
            c.input.count--;
            if (c.input.count <= 0) c.input = null;
            if (!c.output) c.output = { thing: outId, count: recipe.qty };
            else c.output.count += recipe.qty;
          }
          changed = true;
        } else {
          c.cookTime = 0;
        }
        if (changed) this.onFurnaceChanged?.();
      } else if (c.cookTime > 0) {
        c.cookTime = Math.max(0, c.cookTime - dt * 2);
      }
    }
  }

  slotsOf(x, y, z) {
    const c = this.get(x, y, z);
    return c ? {
      input:  { get: () => c.input,  set: s => { c.input = s; } },
      fuel:   { get: () => c.fuel,   set: s => { c.fuel = s; } },
      output: { get: () => c.output, set: s => { c.output = s; } },
      cont: c,
    } : null;
  }
}
