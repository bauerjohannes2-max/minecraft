# VoxelCraft Engineering & 3D Math Guardrails

## 1. WebGL & Three.js Voxel Meshing: Outward Normal Invariant
When building `BufferGeometry` for voxel faces with `QUAD_INDICES = [0, 1, 2, 2, 1, 3]`:
- Vertices must be arranged in Counter-Clockwise (CCW) order viewed from the outside looking at the face.
- For all faces, verify that $(v_1 - v_0) \times (v_2 - v_0)$ matches the face `dir`.
- Face corners configuration:
  - `+X` ([ 1, 0, 0]): `[[1,1,1], [1,0,1], [1,1,0], [1,0,0]]`
  - `-X` ([-1, 0, 0]): `[[0,1,0], [0,0,0], [0,1,1], [0,0,1]]`
  - `+Y` ([ 0, 1, 0]): `[[0,1,0], [0,1,1], [1,1,0], [1,1,1]]`
  - `-Y` ([ 0,-1, 0]): `[[0,0,1], [0,0,0], [1,0,1], [1,0,0]]`
  - `+Z` ([ 0, 0, 1]): `[[0,1,1], [0,0,1], [1,1,1], [1,0,1]]`
  - `-Z` ([ 0, 0,-1]): `[[1,1,0], [1,0,0], [0,1,0], [0,0,0]]`

## 2. Cross-Quad Billboard UVs
For cross-quad sprites (tallgrass, flowers, torches), $y=0$ corresponds to bottom corners ($v_0$) and $y=1$ corresponds to top corners ($v_1$):
```javascript
buf.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
```

## 3. UI Callback Nullish Coalescing (`??`) Guardrail
Never use `ref.set?.(val) ?? fallback` since void functions return `undefined` on success, inadvertently triggering the fallback and duplicating items. Always use explicit branching:
```javascript
if (ref.set) ref.set(val);
else inv.slots[idx] = val;
```

## 4. Planar Movement Yaw Rotation
For Three.js cameras with `'YXZ'` rotation order, planar velocity from local input $(fx, fz)$ with $W = (0, -1)$ requires:
```javascript
const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
out.x =  fx * cos + fz * sin;
out.z = -fx * sin + fz * cos;
```
