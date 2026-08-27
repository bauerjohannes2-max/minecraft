/* ============================================================
   VOXELCRAFT — config.js
   Block registry, world constants, gameplay tuning.
   ============================================================ */

// ---------------- WORLD CONSTANTS ----------------
export const CONFIG = {
  CHUNK_SIZE: 16,          // blocks per chunk side (x/z)
  WORLD_HEIGHT: 64,        // total world height in blocks
  RENDER_DISTANCE: 5,      // chunks loaded around player (radius)
  SEA_LEVEL: 24,
  GRAVITY: 28,             // blocks/s²
  MAX_FALL_SPEED: 50,

  // player physics
  PLAYER_WALK_SPEED: 4.5,
  PLAYER_SPRINT_SPEED: 7.0,
  PLAYER_SNEAK_SPEED: 1.8,
  PLAYER_SWIM_SPEED: 3.0,
  PLAYER_JUMP_VELOCITY: 8.6,
  PLAYER_HEIGHT: 1.8,
  PLAYER_EYE_HEIGHT: 1.62,
  PLAYER_HALF_WIDTH: 0.3,
  PLAYER_REACH: 5.0,       // block interaction distance

  // survival
  MAX_HEALTH: 20,          // 10 hearts
  MAX_HUNGER: 20,          // 10 drumsticks
  FALL_DAMAGE_THRESHOLD: 4,// blocks fallen before damage starts
  HUNGER_TICK_SECONDS: 45, // hunger decreases every N seconds
  STARVE_DAMAGE: 1,

  // day cycle
  DAY_LENGTH: 600,         // seconds for full day/night cycle

  // mobs
  MOB_CAP_PASSIVE: 12,
  MOB_CAP_HOSTILE: 10,
};

// ---------------- BLOCK DEFINITIONS ----------------
// name: unique id string
// hard: seconds to break by hand (-1 = unbreakable)
// tool: preferred tool type ('pickaxe'|'axe'|'shovel'|null)
// solid: collides with entities?
// transparent: light/faces pass through?
export const BLOCKS = {
  air:      { id: 'air',      hard: -1,   tool: null,     solid: false, transparent: true },
  grass:    { id: 'grass',    hard: 0.9,  tool: 'shovel', solid: true,  transparent: false },
  dirt:     { id: 'dirt',     hard: 0.75, tool: 'shovel', solid: true,  transparent: false },
  stone:    { id: 'stone',    hard: 2.2,  tool: 'pickaxe',solid: true,  transparent: false },
  cobble:   { id: 'cobble',   hard: 2.4,  tool: 'pickaxe',solid: true,  transparent: false },
  sand:     { id: 'sand',     hard: 0.7,  tool: 'shovel', solid: true,  transparent: false },
  wood_log: { id: 'wood_log', hard: 1.8,  tool: 'axe',    solid: true,  transparent: false },
  leaves:   { id: 'leaves',   hard: 0.35, tool: null,     solid: true,  transparent: true },
  planks:   { id: 'planks',   hard: 1.6,  tool: 'axe',    solid: true,  transparent: false },
  bedrock:  { id: 'bedrock',  hard: -1,   tool: null,     solid: true,  transparent: false },
  water:    { id: 'water',    hard: -1,   tool: null,     solid: false, transparent: true },
  snow:     { id: 'snow',     hard: 0.65, tool: 'shovel', solid: true,  transparent: false },
  gravel:   { id: 'gravel',   hard: 0.9,  tool: 'shovel', solid: true,  transparent: false },
  coal_ore: { id: 'coal_ore', hard: 3.0,  tool: 'pickaxe',solid: true,  transparent: false },
  iron_ore: { id: 'iron_ore', hard: 3.5,  tool: 'pickaxe',solid: true,  transparent: false },
  gold_ore: { id: 'gold_ore', hard: 3.5,  tool: 'pickaxe',solid: true,  transparent: false },
  diamond_ore:{ id:'diamond_ore',hard: 4.5,tool: 'pickaxe',solid: true,  transparent: false },
  cactus:   { id: 'cactus',   hard: 0.6,  tool: null,     solid: true,  transparent: true },
  flower:   { id: 'flower',   hard: 0.05, tool: null,     solid: false, transparent: true },
  tallgrass:{ id: 'tallgrass',hard: 0.05, tool: null,     solid: false, transparent: true },
  torch:    { id: 'torch',    hard: 0.05, tool: null,     solid: false, transparent: true },
  crafting_table: { id: 'crafting_table', hard: 1.5, tool: 'axe', solid: true, transparent: false },
  furnace:  { id: 'furnace',  hard: 2.5, tool: 'pickaxe', solid: true, transparent: false },
  glass:    { id: 'glass',    hard: 0.3, tool: null, solid: true, transparent: true },
};

// Fast numeric IDs for typed arrays (index = stored value)
export const BLOCK_IDS = Object.keys(BLOCKS);
export const B = {};                       // NAME -> numeric id
BLOCK_IDS.forEach((name, i) => B[name.toUpperCase()] = i);
export const NUM_BLOCK_IDS = BLOCK_IDS.length;
export const isAir    = t => t === B.AIR;
export const isSolid  = t => BLOCKS[BLOCK_IDS[t]]?.solid ?? false;
export const isTransparent = t => BLOCKS[BLOCK_IDS[t]]?.transparent ?? true;

// Light emission per block (torch = 14, etc.)
export const LIGHT_EMISSION = new Uint8Array(NUM_BLOCK_IDS);
LIGHT_EMISSION[B.TORCH] = 14;

// Which face texture each block uses [top, bottom, sides] —
// indices into the texture atlas built in graphics/textures.js
export const BLOCK_FACE_TILES = {
  [B.GRASS]:    ['grass_top', 'dirt', 'grass_side'],
  [B.DIRT]:     ['dirt','dirt','dirt'],
  [B.STONE]:    ['stone','stone','stone'],
  [B.COBBLE]:   ['cobble','cobble','cobble'],
  [B.SAND]:     ['sand','sand','sand'],
  [B.WOOD_LOG]: ['log_top','log_top','log_side'],
  [B.LEAVES]:   ['leaves','leaves','leaves'],
  [B.PLANKS]:   ['planks','planks','planks'],
  [B.BEDROCK]:  ['bedrock','bedrock','bedrock'],
  [B.WATER]:    ['water','water','water'],
  [B.SNOW]:     ['snow','dirt','snow_side'],
  [B.GRAVEL]:   ['gravel','gravel','gravel'],
  [B.COAL_ORE]: ['coal_ore','coal_ore','coal_ore'],
  [B.IRON_ORE]: ['iron_ore','iron_ore','iron_ore'],
  [B.GOLD_ORE]: ['gold_ore','gold_ore','gold_ore'],
  [B.DIAMOND_ORE]:['diamond_ore','diamond_ore','diamond_ore'],
  [B.CACTUS]:   ['cactus_top','cactus_top','cactus_side'],
  [B.FLOWER]:   ['flower','flower','flower'],
  [B.TALLGRASS]:['tallgrass','tallgrass','tallgrass'],
  [B.TORCH]:    ['torch','torch','torch'],
  [B.CRAFTING_TABLE]: ['craft_top','planks','craft_side'],
  [B.FURNACE]:  ['furnace_top','furnace_top','furnace_front'],
  [B.GLASS]:    ['glass','glass','glass'],
};

// Blocks that drop something other than themselves
export const BLOCK_DROPS = {
  [B.GRASS]:    B.DIRT,
  [B.STONE]:    B.COBBLE,
  [B.LEAVES]:   () => Math.random() < 0.08 ? B.WOOD_LOG : B.AIR,
  [B.COAL_ORE]: 113,   // coal item
  [B.IRON_ORE]: B.IRON_ORE,
  [B.GOLD_ORE]: B.GOLD_ORE,
  [B.DIAMOND_ORE]: B.DIAMOND_ORE,
  [B.TALLGRASS]: () => Math.random() < 0.45 ? 116 /* wheat_seeds */ : B.AIR,
  [B.LEAVES]: () => Math.random() < 0.15 ? 100 /* stick */ : B.AIR,
};

// ---------------- ITEM DEFINITIONS (non-block items) ----------------
// Items use ids >= 100 so they never collide with block numeric ids
export const ITEMS = {
  stick:        { id: 100, name: 'Stick',          stack: 64 },
  wood_pick:    { id: 101, name: 'Wooden Pickaxe', stack: 1, tool: 'pickaxe', speed: 2.5 },
  stone_pick:   { id: 102, name: 'Stone Pickaxe',  stack: 1, tool: 'pickaxe', speed: 4.5 },
  iron_pick:    { id: 103, name: 'Iron Pickaxe',   stack: 1, tool: 'pickaxe', speed: 8.0 },
  wood_axe:     { id: 104, name: 'Wooden Axe',     stack: 1, tool: 'axe',     speed: 2.5 },
  stone_axe:    { id: 105, name: 'Stone Axe',      stack: 1, tool: 'axe',     speed: 4.5 },
  wood_shovel:  { id: 106, name: 'Wooden Shovel',  stack: 1, tool: 'shovel',  speed: 2.5 },
  stone_shovel: { id: 107, name: 'Stone Shovel',   stack: 1, tool: 'shovel',  speed: 4.5 },

  iron_ingot:   { id: 108, name: 'Iron Ingot',     stack: 64 },
  raw_porkchop: { id: 110, name: 'Raw Porkchop',   stack: 64, food: 3 },
  cooked_pork:  { id: 111, name: 'Cooked Porkchop',stack: 64, food: 8 },
  rotten_flesh: { id: 112, name: 'Rotten Flesh',   stack: 64, food: 2, poisonChance: 0.5 },
  coal:         { id: 113, name: 'Coal',           stack: 64 },

  wood_hoe:     { id: 114, name: 'Wooden Hoe',     stack: 1, tool: 'hoe',     speed: 1.0 },
  stone_hoe:    { id: 115, name: 'Stone Hoe',      stack: 1, tool: 'hoe',     speed: 1.0 },
  wheat_seeds:  { id: 116, name: 'Wheat Seeds',    stack: 64 },
  wheat:        { id: 117, name: 'Wheat',          stack: 64 },
  bread:        { id: 118, name: 'Bread',          stack: 64, food: 5 },
  raw_beef:     { id: 119, name: 'Raw Beef',       stack: 64, food: 3 },
  steak:        { id: 120, name: 'Cooked Steak',   stack: 64, food: 8 },
  wool:         { id: 121, name: 'Wool',           stack: 64 },
  leather:      { id: 122, name: 'Leather',        stack: 64 },
  gunpowder:    { id: 123, name: 'Gunpowder',      stack: 64 },

  wood_sword:     { id: 130, name: 'Wooden Sword',    stack: 1, tool: 'sword', dmg: 4 },
  stone_sword:    { id: 131, name: 'Stone Sword',     stack: 1, tool: 'sword', dmg: 5 },
  iron_sword:     { id: 132, name: 'Iron Sword',      stack: 1, tool: 'sword', dmg: 7 },

  leather_helmet: { id: 133, name: 'Leather Cap',     stack: 1, slot: 'head',  armor: 1 },
  leather_tunic:  { id: 134, name: 'Leather Tunic',   stack: 1, slot: 'chest', armor: 2 },
  iron_helmet:    { id: 135, name: 'Iron Helmet',     stack: 1, slot: 'head',  armor: 2 },
  iron_chest:     { id: 136, name: 'Iron Chestplate', stack: 1, slot: 'chest', armor: 4 },

  bow:            { id: 140, name: 'Bow',             stack: 1 },
  arrow:          { id: 141, name: 'Arrow',           stack: 64 },
  feather:        { id: 142, name: 'Feather',         stack: 64 },
  stringy:        { id: 143, name: 'String',          stack: 64 },
};
// item helpers
export const ITEM_IDS = Object.fromEntries(
  Object.entries(ITEMS).map(([k,v]) => [v.id, k])
);
// "thing" helper: <100 = placeable block id, >=100 = ITEMS key
export const thingIsBlock = n => n < 100;

// Tool efficiency vs block tools — used in mining.js
export const TOOL_MATCH_BONUS = {
  pickaxe: { pickaxe: 1, axe: 1, shovel: 1 },
  axe:     { pickaxe: 1, axe: 1, shovel: 1 },
  shovel:  { pickaxe: 1, axe: 1, shovel: 1 },
};

// ---------------- BIOMES ----------------
export const BIOMES = {
  PLAINS:   { base: 26, amp: 5,  surface: 'GRASS', filler: 'DIRT',   trees: 0.003, flowers: true },
  FOREST:   { base: 27, amp: 7,  surface: 'GRASS', filler: 'DIRT',   trees: 0.03,  flowers: true },
  DESERT:   { base: 25, amp: 4,  surface: 'SAND',  filler: 'SAND',   trees: 0,     cacti: true },
  MOUNTAINS:{ base: 34, amp: 18, surface: 'STONE', filler: 'STONE',  snowLine: 42 },
  OCEAN:    { base: 16, amp: 5,  surface: 'SAND',  filler: 'SAND' },
  SNOWY:    { base: 27, amp: 6,  surface: 'SNOW',  filler: 'DIRT',   trees: 0.01 },
};

// ---------------- ENTITY TYPES ----------------
export const MOB_TYPES = {
  pig:      { w: 0.9, h: 0.9, hp: 10, passive: true,  speed: 1.6, drop: 110 /*raw_porkchop*/, color: 0xEBA3A3 },
  sheep:    { w: 0.9, h: 1.2, hp: 8,  passive: true,  speed: 1.5, drop: 121 /*wool*/,         color: 0xDDDDDD },
  cow:      { w: 0.9, h: 1.3, hp: 10, passive: true,  speed: 1.4, drop: 119 /*raw_beef*/,     color: 0x4A3626 },
  zombie:   { w: 0.6, h: 1.9, hp: 20, hostile: true,  speed: 2.4, damage: 3, drop: 112 /*rotten_flesh*/, color: 0x55883B },
  skeleton: { w: 0.6, h: 1.9, hp: 20, hostile: true,  speed: 2.2, damage: 2, drop: 141 /*arrow*/,        color: 0xC9C9C9 },
};

console.log('[config] registry loaded:', NUM_BLOCK_IDS, 'blocks,', Object.keys(ITEMS).length, 'items,', RECIPES.length, 'recipes');
