/* ============================================================
   VOXELCRAFT — net.js
   Real-time multiplayer networking:
   - Connects to WebSocket relay
   - Spawns & smoothly interpolates remote player avatars
   - Synchronizes block delta edits across clients
   - Sends local position @ 10Hz & chat messages
   ============================================================ */

import * as THREE from 'three';
import { buildPlayerAvatar } from '../mobs/models.js';
import { G, toast } from '../main.js';

const SEND_RATE = 10;
const LERP_DELAY = 0.10;
const _tmpV = new THREE.Vector3();

export class NetSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.remotes = new Map(); // id → {avatar, target, prev, t, name}
    this.connected = false;
    this.myId = null;
    this.name = 'Steve';
    this._sendAcc = 0;
  }

  connect(url = `ws://${(typeof location !== 'undefined' && location.hostname) ? location.hostname : 'localhost'}:9090`, name = 'Steve') {
    this.name = name;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.warn('[net] WebSocket connect failed', e);
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[net] connected to', url);
    };

    this.ws.onclose = () => {
      this.connected = false;
      toast?.('📴 Disconnected from multiplayer');
    };

    this.ws.onerror = () => {
      console.warn('[net] multiplayer relay offline — running local solo');
    };

    this.ws.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        this._recv(m);
      } catch (err) {
        console.warn('[net] invalid message', err);
      }
    };
  }

  send(obj) {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _recv(m) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        toast?.(`🌐 Connected! You are player #${m.id}`);
        this.send({
          t: 'pos',
          x: G.player?.pos.x ?? 0,
          y: G.player?.pos.y ?? 40,
          z: G.player?.pos.z ?? 0,
          yaw: G.controls?.yaw ?? 0,
          pitch: G.controls?.pitch ?? 0,
          name: this.name,
        });
        break;

      case 'pos': {
        if (m.id === this.myId) return;
        let r = this.remotes.get(m.id);
        if (!r) {
          const avatar = buildPlayerAvatar(m.name || `Player #${m.id}`);
          avatar.group.position.set(m.x, m.y, m.z);
          this.scene.add(avatar.group);
          r = {
            avatar,
            prev: { x: m.x, y: m.y, z: m.z, yaw: m.yaw ?? 0 },
            target: { x: m.x, y: m.y, z: m.z, yaw: m.yaw ?? 0 },
            t: 0,
            name: m.name,
          };
          this.remotes.set(m.id, r);
          toast?.(`👋 ${m.name || 'Player'} joined!`);
        }

        r.prev = {
          x: r.avatar.group.position.x,
          y: r.avatar.group.position.y,
          z: r.avatar.group.position.z,
          yaw: r.avatar.group.rotation.y,
        };
        r.target = { x: m.x, y: m.y, z: m.z, yaw: m.yaw ?? 0 };
        r.t = 0;
        r.avatar.setWalk(m.moving ?? false);
        break;
      }

      case 'edit':
        if (m.id === this.myId) return;
        if (this.world) {
          this.world.setBlock(m.x, m.y, m.z, m.b, { silent: true });
        }
        break;

      case 'chat': {
        const sender = m.name ? m.name : `Player #${m.id}`;
        G.chat?.addLine(`<${sender}> ${m.msg}`);
        break;
      }

      case 'leave': {
        const r = this.remotes.get(m.id);
        if (r) {
          this.scene.remove(r.avatar.group);
          r.avatar.group.traverse(o => o.geometry?.dispose());
          this.remotes.delete(m.id);
          toast?.(`🚪 ${r.name || 'A player'} left`);
        }
        break;
      }
    }
  }

  update(dt, player, controls) {
    if (!player || !controls) return;

    // Send local position @ 10Hz
    this._sendAcc += dt;
    if (this._sendAcc >= 1 / SEND_RATE && this.connected) {
      this._sendAcc = 0;
      const wish = controls.getMoveVector(_tmpV);
      this.send({
        t: 'pos',
        x: +player.pos.x.toFixed(2),
        y: +player.pos.y.toFixed(2),
        z: +player.pos.z.toFixed(2),
        yaw: +controls.yaw.toFixed(2),
        pitch: +controls.pitch.toFixed(2),
        name: this.name,
        moving: wish.lengthSq() > 0.01,
      });
    }

    // Interpolate remote avatars
    for (const r of this.remotes.values()) {
      r.t += dt / LERP_DELAY;
      const k = Math.min(1, r.t);

      if (r.target && r.prev) {
        r.avatar.group.position.set(
          THREE.MathUtils.lerp(r.prev.x, r.target.x, k),
          THREE.MathUtils.lerp(r.prev.y, r.target.y, k),
          THREE.MathUtils.lerp(r.prev.z, r.target.z, k)
        );

        // shortest arc yaw lerp
        let dy = r.target.yaw - r.prev.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        r.avatar.group.rotation.y = r.prev.yaw + dy * k;
      }

      // Leg animation
      if (r.avatar._walking) {
        const s = Math.sin(performance.now() / 120) * 0.55;
        r.avatar.legs[0].rotation.x = s;
        r.avatar.legs[1].rotation.x = -s;
      } else {
        r.avatar.legs[0].rotation.x *= 0.8;
        r.avatar.legs[1].rotation.x *= 0.8;
      }
    }
  }

  notifyEdit(x, y, z, b) {
    this.send({ t: 'edit', x, y, z, b });
  }
}
