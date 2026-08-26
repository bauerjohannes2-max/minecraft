/* ============================================================
   VOXELCRAFT — main.js
   Game orchestration: bootstraps renderer, world, player,
   streams chunks around the player, runs the fixed game loop.
   ============================================================ */

import * as THREE from 'three';
import { CONFIG, B, BLOCK_IDS, ITEMS } from './config.js';
import { createNoiseSet } from './core/noise.js';
import { World } from './core/world.js';
import { WorldGen } from './core/worldgen.js';
import { meshChunk } from './core/mesher.js';
import { Controls } from './player/controls.js';
import { FPSCamera } from './player/camera.js';
import { Player } from './player/player.js';
import { MiningSystem } from './gameplay/mining.js';
import { PlacingSystem } from './gameplay/placing.js';
import { DropSystem } from './gameplay/drops.js';
import { Inventory, InventoryUI } from './gameplay/inventory.js';
import { CraftingUI } from './gameplay/crafting.js';
import { Containers } from './gameplay/containers.js';
import { BlockUI } from './ui/blockui.js';
import { HUD, G_SHAKE } from './ui/hud.js';
import { MobManager } from './mobs/mobs.js';
import { EatingSystem } from './gameplay/eating.js';
import { SwimSystem } from './gameplay/swimming.js';
import { SkySystem } from './graphics/sky.js';
import { DeathScreen } from './ui/deathscreen.js';
import { SaveSystem } from './core/save.js';
import { raycastVoxel } from './gameplay/raycast.js';

// ---------------- global state ----------------
export const G = {
  scene: null,
  renderer: null,
  world: null,
  worldGen: null,
  player: null,
  controls: null,
  fpsCam: null,
  mining: null,
  placing: null,
  drops: null,
  inventory: null,
  inventoryUI: null,
  crafting2x2: null,
  containers: null,
  blockUI: null,
  mobs: null,
  hud: null,
  eating: null,
  swim: null,
  sky: null,
  death: null,
  combat: null,
  save: null,
  spawnPos: { x: 8.5, y: 40, z: 8.5 },
  seed: 1337,
  playTime: 0,
  paused: false,
  started: false,
};

let useLatch = false;
let controlsPlacedThisFrame = false;

// ---------------- boot ----------------
export function boot() {
  console.log('[main] booting…');

  const canvas = document.getElementById('game-canvas');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  G.scene = new THREE.Scene();
  G.sky = new SkySystem(G.scene, G.renderer);

  G.sky.onTimeChange = (t) => {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const h = Math.floor(((t + 0.5) % 1) * 24);
    const m = Math.floor((((t + 0.5) % 1) * 24 % 1) * 60);
    clockEl.textContent =
      `${G.sky.isNight() ? '🌙' : '☀️'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  G.controls = new Controls(canvas);
  G.fpsCam = new FPSCamera();

  wireControls();
  setupTitleMenu();

  addEventListener('resize', () => {
    G.renderer.setSize(innerWidth, innerHeight);
    G.fpsCam.resize();
  });

  window.addEventListener('beforeunload', () => {
    if (G.started && G.save) G.save.saveAll(G);
  });

  console.log('[main] ready.');
}

function setupTitleMenu() {
  const contBtn = document.getElementById('btn-continue');
  const infoEl = document.getElementById('continue-info');
  if (SaveSystem.exists()) {
    contBtn?.classList.remove('hidden');
    if (infoEl) infoEl.textContent = '🌍 ' + (SaveSystem.summary() || 'Saved World');
    contBtn?.addEventListener('click', () => startGame(true));
  } else {
    contBtn?.classList.add('hidden');
  }

  document.getElementById('btn-new-world')?.addEventListener('click', () => {
    if (SaveSystem.exists() && !confirm('Start a NEW world? Your saved world will be erased!')) return;
    SaveSystem.wipe();
    startGame(false);
  });
}

// ---------------- world start ----------------
async function startGame(continueSaved) {
  showScreen('loading-screen');
  setLoadBar(15, 'Initializing world…');

  let savedState = null;
  if (continueSaved) {
    G.save = new SaveSystem(null);
    savedState = G.save.loadInto(G);
    if (!savedState) {
      alert('Save data could not be loaded, starting fresh.');
      return startGame(false);
    }
  } else {
    G.seed = (Date.now() % 2147483647);
  }

  const noiseSet = createNoiseSet(G.seed);
  G.world = new World(noiseSet);
  G.save = new SaveSystem(G.world);
  G.world.onBlockChanged = (x, y, z, t) => G.save.recordEdit(x, y, z, t);

  const worldGen = new WorldGen(noiseSet);
  G.worldGen = worldGen;
  G.world.generateChunk = (chunk) => {
    worldGen.generate(chunk);
    G.save.applyDiffs(chunk);
  };
  G.world.buildChunkMesh = (chunk) => meshChunk(chunk, G.world, G.scene);

  G.player = new Player(G.world);
  G.swim = new SwimSystem(G.player, G.world);

  // death & respawn
  G.death = new DeathScreen(G.player, () => {
    G.player.teleport(G.spawnPos.x, G.spawnPos.y, G.spawnPos.z);
    G.controls.requestLock();
  });

  // gameplay systems
  G.mobs = new MobManager(G.world, G.scene);
  G.mobs.isNight = () => G.sky.isNight();

  G.mining = new MiningSystem(G.world, G.scene);
  G.placing = new PlacingSystem(G.world, () => [G.player, ...(G.mobs ? G.mobs.allEntities() : [])]);
  G.inventory = new Inventory();
  G.inventoryUI = new InventoryUI(G.inventory);
  G.containers = new Containers(G.world);
  G.blockUI = new BlockUI(G.inventory, G.inventoryUI, G.containers);

  G.crafting2x2 = new CraftingUI(G.inventory, G.inventoryUI, 4);
  const invPanel = document.getElementById('inventory-panel');
  if (invPanel) G.crafting2x2.mount(invPanel);
  G.crafting2x2.onCrafted = (thing, count) => toast(`🛠️ crafted ×${count}`);

  G.drops = new DropSystem(G.world, G.scene);
  G.world.spillDrops = (thing, count, x, y, z) => G.drops.spawn(thing, count, x + 0.5, y + 0.5, z + 0.5);

  G.mobs.attackPlayer = (dmg, fromPos) => G.combat.damagePlayer(dmg, fromPos);
  G.mobs.getDropsSpawnCB = (thing, count, x, y, z) => G.drops.spawn(thing, count, x, y, z);

  G.hud = new HUD(G.player, G.inventory);
  G.eating = new EatingSystem(G.player, G.inventory, G.hud);
  G.eating.onEaten = (def) => toast(`🍖 ${def.name} (+${def.food} hunger)`);
  G.eating.onPoison = () => toast('☠️ That flesh was ROTTEN!');

  G.drops.onPickup = (thing, count) => {
    const left = G.inventory.add(thing, count);
    const kept = count - left;
    if (kept > 0) toast(`+${kept} ${G.inventory.labelOf(thing)}`);
    return left === 0;
  };

  G.mining.onBlockBroken = (type, x, y, z) => {
    G.containers.onBlockRemoved(x, y, z);
    const t = DropSystem.dropFor(type);
    if (t != null) G.drops.spawn(t, 1, x + 0.5, y + 0.5, z + 0.5);
  };

  G.placing.onPlaced = (x, y, z, type) => {
    G.inventory.consumeHeld(1);
    G.containers.onBlockPlaced(type, x, y, z);
    controlsPlacedThisFrame = true;
  };

  if (continueSaved && savedState) {
    setLoadBar(50, 'Restoring world state…');
    if (G.pendingInventoryJSON) G.inventory.deserialize(G.pendingInventoryJSON);
    if (G.pendingFurnaces) {
      for (const f of G.pendingFurnaces) {
        G.containers.onBlockPlaced(B.FURNACE, f.pos.x, f.pos.y, f.pos.z);
        const c = G.containers.get(f.pos.x, f.pos.y, f.pos.z);
        if (c) {
          Object.assign(c, {
            input: f.input, fuel: f.fuel, output: f.output,
            burnTime: f.burnTime, burnMax: f.burnMax, cookTime: f.cookTime,
          });
        }
      }
    }
    G.player.pos.set(savedState.pos.x, savedState.pos.y, savedState.pos.z);
    G.player.health = savedState.health;
    G.player.hunger = savedState.hunger;
    G.controls.yaw = savedState.yaw ?? 0;
    G.controls.pitch = savedState.pitch ?? 0;
    G.fpsCam.yaw = G.controls.yaw;
    G.fpsCam.pitch = G.controls.pitch;
    G.playTime = savedState.playTime;
    G.sky.time = savedState.time ?? 0.3;
    G.spawnPos = { x: savedState.pos.x, y: savedState.pos.y, z: savedState.pos.z };
    G.world.warmup(savedState.pos.x, savedState.pos.z, 2);
    G.world.setStreamingRef({ x: savedState.pos.x / CONFIG.CHUNK_SIZE, z: savedState.pos.z / CONFIG.CHUNK_SIZE });
  } else {
    setLoadBar(50, 'Carving valleys & flora…');
    let sx = 8, sz = 8;
    G.world.warmup(sx, sz, 2);
    const sy = Player.findSpawnY(G.world, sx + 0.5, sz + 0.5);
    G.spawnPos = { x: sx + 0.5, y: sy + 0.1, z: sz + 0.5 };
    G.player.teleport(G.spawnPos.x, G.spawnPos.y, G.spawnPos.z);
    G.world.setStreamingRef({ x: sx / CONFIG.CHUNK_SIZE, z: sz / CONFIG.CHUNK_SIZE });

    // starter kit
    G.inventory.add(B.WOOD_LOG, 16);
    G.inventory.add(B.PLANKS, 32);
    if (B.CRAFTING_TABLE) G.inventory.add(B.CRAFTING_TABLE, 1);
    if (B.FURNACE) G.inventory.add(B.FURNACE, 1);
    if (B.COAL_ORE) G.inventory.add(B.COAL_ORE, 8);
    if (B.IRON_ORE) G.inventory.add(B.IRON_ORE, 8);
    G.inventory.add(110 /* raw_porkchop */, 4);

    for (let i = 0; i < 4; i++) {
      const px = sx + (Math.random() - 0.5) * 20;
      const pz = sz + (Math.random() - 0.5) * 20;
      const py = Player.findSpawnY(G.world, px, pz);
      G.mobs.spawn('pig', px, py, pz);
    }
  }

  G.player.onLand = (impact) => {
    if (impact > CONFIG.FALL_DAMAGE_THRESHOLD) {
      G.player.damage(Math.floor(impact - 3));
    }
  };

  setLoadBar(100, 'Ready!');
  setTimeout(() => {
    hideAllScreens();
    document.getElementById('ui-layer').classList.remove('hidden');
    G.started = true;
    G.controls.requestLock();
    requestAnimationFrame(gameLoop);
    console.log('[main] game started. Seed:', G.seed);
  }, 250);
}

// ---------------- controls wiring ----------------
function wireControls() {
  const c = G.controls;

  c.onPauseRequested = () => {
    if (!G.started || G.player?.health <= 0) return;
    pauseGame();
  };

  c.onDebugToggle = () => {
    document.getElementById('debug-overlay').classList.toggle('hidden');
  };

  c.onFlyToggle = () => {
    G.player.flying = !G.player.flying;
    G.player.vel.y = 0;
    toast(G.player.flying ? '✈️ Fly ON' : '🚶 Fly OFF');
  };

  c.onInventoryToggle = () => {
    if (!G.started || G.player?.health <= 0) return;
    const invPanel = document.getElementById('inventory-panel');
    const wasOpen = !invPanel.classList.contains('hidden') || G.blockUI.isOpen();
    const opening = !wasOpen;

    G.inventoryUI.openPanel(opening);
    if (!opening) {
      G.blockUI.closeAll();
      G.crafting2x2.dumpGridBack();
      G.controls.setUIOpen(false);
      G.controls.requestLock();
    } else {
      G.controls.setUIOpen(true);
    }
  };

  c.onScroll = (dir) => {
    G.inventory.hotbarSel = (G.inventory.hotbarSel + dir + 9) % 9;
    G.inventoryUI.renderAll();
  };

  c.onHotbarKey = (i) => {
    G.inventory.hotbarSel = i;
    G.inventoryUI.renderAll();
  };

  c.onDropItem = () => {
    const s = G.inventory.heldStack();
    if (!s) return;
    const eye = G.player.getEyePosition(new THREE.Vector3());
    const fwd = G.fpsCam.getForward(new THREE.Vector3());
    G.inventory.consumeHeld(1);
    G.drops.spawn(s.thing, 1, eye.x + fwd.x, eye.y, eye.z + fwd.z, false);
    const d = G.drops.drops[G.drops.drops.length - 1];
    if (d) {
      d.vel.set(fwd.x * 5, fwd.y * 5 + 1, fwd.z * 5);
      d.pickupDelay = 1.2;
    }
  };
}

function handleBlockInteraction(dt, player, fpsCam, controls) {
  if (!controls.useHeld || controls.uiOpen || !controls.locked) {
    useLatch = false;
    return false;
  }
  if (useLatch) return false;

  if (controls.isSneaking()) return false;

  const eye = player.getEyePosition(new THREE.Vector3());
  const fwd = fpsCam.getForward(new THREE.Vector3());
  const hit = raycastVoxel(G.world, eye, fwd, 5);

  if (hit.hit && G.blockUI.openFor(hit.block, hit.x, hit.y, hit.z)) {
    useLatch = true;
    G.controls.setUIOpen(true);
    G.inventoryUI.openPanel(true);
    return true;
  }
  return false;
}

// ---------------- COMBAT ----------------
G.combat = {
  swingCooldown: 0,

  update(dt, controls) {
    this.swingCooldown -= dt;
    if (!controls.attackHeld || controls.uiOpen || !controls.locked) return;
    if (this.swingCooldown > 0) return;

    const eye = G.player.getEyePosition(new THREE.Vector3());
    const fwd = G.fpsCam.getForward(new THREE.Vector3());

    let best = null, bestT = 4.0;
    for (const m of G.mobs.mobs) {
      if (m.dead) continue;
      const toM = m.pos.clone().add(new THREE.Vector3(0, m.H * 0.5, 0)).sub(eye);
      const t = toM.dot(fwd);
      if (t < 0 || t > bestT) continue;
      const closest = toM.clone().sub(fwd.clone().multiplyScalar(t)).length();
      if (closest < Math.max(m.W + 0.4, 0.7)) { best = m; bestT = t; }
    }

    if (best) {
      this.swingCooldown = 0.45;
      best.lastAttackerPos = { x: G.player.pos.x, z: G.player.pos.z };
      best.threatPos = best.lastAttackerPos;
      best.fleeTimer = 6;

      const heldItem = G.inventory.heldStack()?.thing;
      const dmg = toolDamage(heldItem);
      best.hurt(dmg, G.player.pos);
    }
  },

  damagePlayer(dmg, fromPos) {
    if (G.player.health <= 0) return;
    G.player.damage(dmg);
    const kx = G.player.pos.x - fromPos.x, kz = G.player.pos.z - fromPos.z;
    const l = Math.hypot(kx, kz) || 1;
    G.player.vel.x += kx / l * 5;
    G.player.vel.z += kz / l * 5;
    G.player.vel.y = Math.max(G.player.vel.y, 3.5);
  },
};

function toolDamage(heldThing) {
  const held = G.inventory.labelOf(heldThing ?? -1);
  if (held?.includes('_pick')) return held.startsWith('iron') ? 4 : held.startsWith('stone') ? 3 : 2;
  if (held?.includes('_axe'))  return held.startsWith('iron') ? 5 : held.startsWith('stone') ? 4 : 3;
  if (held?.includes('_sword')) return held.startsWith('iron') ? 6 : held.startsWith('stone') ? 5 : 4;
  return 1;
}

// ---------------- basic UI helpers ----------------
const SCREENS = ['title-screen', 'loading-screen', 'pause-screen'];

function hideAllScreens() {
  SCREENS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
}
function showScreen(id) {
  hideAllScreens();
  document.getElementById(id)?.classList.remove('hidden');
}
function setLoadBar(pct, msg) {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = pct + '%';
  if (status && msg) status.textContent = msg;
}

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---- pause ----
function pauseGame() {
  G.paused = true;
  showScreen('pause-screen');
}
document.getElementById('btn-resume')?.addEventListener('click', () => {
  G.paused = false;
  hideAllScreens();
  G.controls.requestLock();
});
document.getElementById('btn-save')?.addEventListener('click', () => {
  if (G.save) {
    G.save.saveAll(G);
    toast('💾 Game saved!');
  }
});
document.getElementById('btn-quit')?.addEventListener('click', () => {
  if (G.save) G.save.saveAll(G);
  location.reload();
});

// ============================================================
// GAME LOOP
// ============================================================
const clock = new THREE.Clock();
let fpsCounter = 0, fpsTime = 0, fps = 0;

function gameLoop() {
  requestAnimationFrame(gameLoop);
  if (!G.started) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  fpsCounter++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = Math.round(fpsCounter / fpsTime); fpsCounter = 0; fpsTime = 0; }

  if (!G.paused) {
    step(dt);
  }
  render();
  updateDebug();
}

function step(dt) {
  const p = G.player, c = G.controls;
  controlsPlacedThisFrame = false;
  G.playTime = (G.playTime || 0) + dt;

  // 1. Controls update (mouse look, jump buffer, keys)
  c.update(dt);
  G.fpsCam.yaw = c.yaw;
  G.fpsCam.pitch = c.pitch;

  // 2. Swimming state update (runs before player physics)
  G.swim.update(dt, c);

  // 3. Sky & celestial updates + underwater fog override
  G.sky.suppressFog = G.swim.headUnder;
  G.sky.update(dt, G.fpsCam.camera);

  const fm = G.swim.fogModifier;
  if (fm) {
    G.scene.background.setHex(fm.color);
    G.scene.fog.color.setHex(fm.color);
    G.scene.fog.near = fm.near;
    G.scene.fog.far  = fm.far;
    G.sky.sunLight.intensity *= 0.45;
  }

  // 4. Death check
  G.death.update();
  if (p.health <= 0) {
    if (c.locked) document.exitPointerLock?.();
    return;
  }

  // 5. Quick save check
  if (c.consumeQuickSavePressed()) {
    G.save?.saveAll(G);
    toast('💾 Game saved!');
  }

  // 6. Player physics
  p.update(dt, c, G.fpsCam.yaw);

  // 7. World streaming
  G.world.setStreamingRef({ x: p.pos.x / CONFIG.CHUNK_SIZE, z: p.pos.z / CONFIG.CHUNK_SIZE });
  G.world.updateStreaming(p.pos.x, p.pos.z);

  // 8. combat & mining & placing & eating
  const heldStack = G.inventory.heldStack();
  const hotbarThing = heldStack ? heldStack.thing : B.AIR;

  G.combat.update(dt, c);

  const interacted = handleBlockInteraction(dt, p, G.fpsCam, c);
  if (!interacted) {
    G.mining.update(dt, p, G.fpsCam, c, hotbarThing);
    G.placing.update(dt, p, G.fpsCam, c, hotbarThing);
  }

  if (!c.uiOpen && !controlsPlacedThisFrame && (!heldStack || heldStack.thing >= 100)) {
    G.eating.update(dt, c);
  } else {
    G.eating.update(0, c);
  }

  G.containers.update(dt);
  G.blockUI.tick(dt);

  // 9. mobs & drops
  G.mobs.update(dt, p);
  G.drops.update(dt, p);

  // 10. HUD / health / hunger
  G.hud.update(dt);

  // 11. autosave
  if (G.save) G.save.update(dt, G);

  // 12. camera follows player feet
  G.fpsCam.update(p.pos, {
    sneaking: c.isSneaking(),
    swimming: G.swim.inWater,
    moving: Math.hypot(p.vel.x, p.vel.z) > 0.5,
    sprinting: c.isSprinting(),
    onGround: p.onGround,
    dt,
  });
}

function render() {
  // camera shake
  G.fpsCam.camera.position.x += G_SHAKE.x;
  G.fpsCam.camera.position.y += G_SHAKE.y;
  G.fpsCam.camera.position.z += G_SHAKE.z;

  G.renderer.render(G.scene, G.fpsCam.camera);
}

function updateDebug() {
  const el = document.getElementById('debug-overlay');
  if (el.classList.contains('hidden')) return;
  const s = G.world.stats;
  const p = G.player;
  const looking = G.fpsCam.getForward().multiplyScalar(5).add(
    new THREE.Vector3(Math.floor(p.pos.x), Math.floor(p.pos.y + 1.62), Math.floor(p.pos.z)));
  el.textContent =
`VoxelCraft v1.1
FPS      ${fps}
Time     ${(G.sky.time * 24).toFixed(1)}h (${G.sky.isNight() ? 'Night' : 'Day'})
Air      ${G.swim ? G.swim.air.toFixed(1) : 10}s
XYZ      ${p.pos.x.toFixed(2)} / ${p.pos.y.toFixed(2)} / ${p.pos.z.toFixed(2)}
Chunk    ${Math.floor(p.pos.x/16)}, ${Math.floor(p.pos.z/16)}
Chunks   ${s.chunks} loaded · ${s.pending} queued
Mobs     ${G.mobs ? G.mobs.mobs.length : 0}
HP       ${p.health.toFixed(1)} / 20 · Food ${p.hunger.toFixed(1)} / 20
Ground   ${p.onGround}  Water ${G.swim?.inWater}  Fly ${p.flying}
Look     ${looking.x|0}, ${looking.y|0}, ${looking.z|0}`;
}
