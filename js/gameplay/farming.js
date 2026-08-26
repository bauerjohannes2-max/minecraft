/* ============================================================
   VOXELCRAFT — farming.js
   - RMB with hoe on DIRT/GRASS → FARMLAND
   - RMB with seeds on FARMLAND → WHEAT0
   - growth tick: random ticks near player advance stage WHEATn+1
   - harvesting mature WHEAT3 by breaking it: 1 wheat + 1-2 seeds;
     immature breaks give back the seed only
   ============================================================ */

import { B, ITEMS } from '../config.js';

const idOf = n => ITEMS[n]?.id;
const GROW_TIME = [16, 20, 24]; // seconds per growth stage

export class FarmSystem {
  constructor(world) {
    this.world = world;
    this.crops = new Map(); // "x,y,z" → progress seconds
  }

  tryUse(heldStack, hitBlock) {
    if (!hitBlock || !hitBlock.hit) return false;
    const { x, y, z, block } = hitBlock;

    // HOE: till dirt/grass tops into farmland
    if (heldStack?.thing === ITEMS.wood_hoe?.id ||
        heldStack?.thing === ITEMS.stone_hoe?.id) {
      if ((block === B.DIRT || block === B.GRASS) &&
          this.world.getBlock(x, y + 1, z) === B.AIR) {
        this.world.setBlock(x, y, z, B.FARMLAND);
        return true;
      }
      return false;
    }

    // SEEDS: plant on farmland
    if (heldStack?.thing === idOf('wheat_seeds')) {
      if (block === B.FARMLAND &&
          this.world.getBlock(x, y + 1, z) === B.AIR) {
        this.world.setBlock(x, y + 1, z, B.WHEAT0);
        this.crops.set(`${x},${y + 1},${z}`, 0);
        return true;
      }
    }
    return false;
  }

  update(dt) {
    for (const [key, t] of this.crops) {
      const nt = t + dt;
      this.crops.set(key, nt);

      const [x, y, z] = key.split(',').map(Number);
      const cur = this.world.getBlock(x, y, z);
      const stageIdx = cur - B.WHEAT0;

      if (stageIdx < 0 || stageIdx >= GROW_TIME.length) {
        this.crops.delete(key);
        continue;
      }

      if (nt >= GROW_TIME[stageIdx] * (0.7 + Math.random() * 0.6)) {
        this.world.setBlock(x, y, z, cur + 1);
        this.crops.set(key, 0);
      }
    }
  }

  harvestReward(type, x, y, z) {
    const stageIdx = type - B.WHEAT0;
    if (stageIdx < 0 || stageIdx > 3) return null;
    const ripe = stageIdx === 3;
    return {
      drops: ripe ? [
        { thing: idOf('wheat'), count: 1 },
        { thing: idOf('wheat_seeds'), count: 1 + ((Math.random() * 2) | 0) },
      ] : [{ thing: idOf('wheat_seeds'), count: 1 }],
      pos: { x, y, z },
    };
  }
}
