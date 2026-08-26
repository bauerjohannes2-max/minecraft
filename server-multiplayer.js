/* ============================================================
   VOXELCRAFT — server-multiplayer.js
   Lightweight WebSocket relay server:
   - Broadcasts player positions and yaw/pitch @ 10Hz
   - Broadcasts block delta edits in real-time
   - Broadcasts chat messages
   ============================================================ */

const http = require('http');
let WebSocketServer;
try {
  WebSocketServer = require('ws').WebSocketServer || require('ws').Server;
} catch (e) {
  console.log('📦 Installing ws package...');
  require('child_process').execSync('npm install ws --no-audit --no-fund', { stdio: 'inherit' });
  WebSocketServer = require('ws').WebSocketServer || require('ws').Server;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('VoxelCraft WebSocket Relay Server is running on port 9090\n');
});

const wss = new WebSocketServer({ server });
let nextId = 1;

const send = (ws, obj) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
};

const broadcast = (obj, except) => {
  for (const c of wss.clients) {
    if (c !== except && c.readyState === 1) {
      c.send(JSON.stringify(obj));
    }
  }
};

wss.on('connection', ws => {
  const id = nextId++;
  console.log(`[relay] Player #${id} connected (${wss.clients.size} online)`);
  send(ws, { t: 'welcome', id });

  ws.on('message', raw => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    m.id = id;

    switch (m.t) {
      case 'pos':
        broadcast(m, ws);
        break;
      case 'edit':
        broadcast(m, ws);
        break;
      case 'chat':
        m.msg = String(m.msg || '').slice(0, 120);
        broadcast(m);
        break;
    }
  });

  ws.on('close', () => {
    console.log(`[relay] Player #${id} disconnected (${wss.clients.size} online)`);
    broadcast({ t: 'leave', id });
  });
});

server.listen(9090, () => {
  console.log('🎮 VoxelCraft relay active on ws://localhost:9090');
});
