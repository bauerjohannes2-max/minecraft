# ⛏️ VoxelCraft 🌍

A complete, feature-packed Minecraft-like voxel survival sandbox built in JavaScript using Three.js.

![VoxelCraft](https://img.shields.io/badge/Three.js-3D%20Engine-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-WebSocket%20Relay-blue)
![License](https://img.shields.io/badge/License-MIT-orange)

---

## 🌟 Features

- 🌄 **Procedural Infinite World Generation**: Multi-octave Perlin/Simplex terrain with biomes (plains, hills, forests, beaches, oceans), 3D subterranean cave networks, and flora (tall grass, flowers, oak trees).
- 🧱 **Complete Voxel Engine & Meshing**: Greedy/Culled face meshing, transparent water pass, X-quad cross plants, block breaking crack stages, and particle debris physics.
- 💡 **Voxel Flood-Fill Lighting**: Real-time BFS light propagation across air cells. Torches emit warm illumination inside deep caverns.
- 🌅 **Day & Night Celestial Cycle**: Orbiting sun and moon, starfield dome, dynamic sky/fog colors, and daytime burning zombies.
- 🏊 **Underwater Physics & Swimming**: Buoyancy, 3-axis water drag, bubble air meter HUD, drowning damage ticks, and deep-blue underwater fog.
- 🌾 **Renewable Farming Economy**: Break tall grass for seeds, craft hoes, till soil into farmland, plant crops through 4 growth stages, harvest wheat, and bake bread!
- 💥 **Destructive TNT Physics**: Torch-ignited fuses with white/red flashing, spherical crater destructions, chain-reactions, and flying physics debris cubes.
- ⚔️ **Combat & Weapon Tiers**: Wooden, Stone, and Iron swords with quick 0.35s swing cooldowns.
- 🛡️ **Armor Sets & Damage Absorption**: Craft Leather and Iron helmets & chestplates that absorb up to 60% of incoming damage with HUD shield pips.
- 🏹 **Projectile Bow & Arrows**: Right-click draw charge meter, gravity-arced ballistic flight up to 34 m/s, knockback, and wall-embedding.
- 🐷 **Fauna & AI**: Passive pigs, sheep, and cows with drops (pork, beef, leather, wool), plus night-spawning hostile zombies.
- 💾 **Delta Save System**: Saves only modified block diffs to `localStorage` (fresh spawn takes ~2KB). Continue saved worlds across sessions.
- 🌍 **Real-Time Multiplayer**: WebSocket relay server broadcasting player positions, 3D animated avatars with nametags, shared voxel edits, and in-game chat (`T`).

---

## 🎮 Controls

| Key | Action |
| --- | --- |
| **W, A, S, D** | Move (Camera-derived ground truth) |
| **Space** | Jump / Swim Up in Water |
| **Left Shift** | Sneak / Sink in Water |
| **Left Click** | Mine block / Attack mob |
| **Right Click** | Place block / Interact (Furnace, Table) / Eat / Bow Charge / Ignite TNT |
| **1 – 9 / Scroll** | Hotbar selection |
| **E** | Open Inventory & Armor Equipment |
| **Q** | Drop held item |
| **T** | Open Chat |
| **F** | Toggle Fly mode (Creative) |
| **F3** | Toggle Debug overlay |
| **F5** | Quick Save |
| **Esc** | Pause Game / Close UI |

---

## 🚀 Getting Started

### 1. Install & Run Multiplayer Relay Server
```bash
npm install
node server-multiplayer.js
```
The relay server runs on `ws://localhost:9090`.

### 2. Serve the Client
You can use any static HTTP server (e.g. Python, Vite, or Live Server):
```bash
python -m http.server 8080
```
Open **`http://localhost:8080`** in your browser!

To play multiplayer, open multiple tabs or share your local network IP!
