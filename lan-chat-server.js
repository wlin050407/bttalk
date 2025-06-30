// lan-chat-server.js
// 局域网WebSocket聊天服务器

const WebSocket = require('ws');
const os = require('os');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    // 广播给所有客户端
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

console.log('局域网WebSocket聊天服务器已启动!');
console.log(`请在同一WiFi下用浏览器访问 ws://${getLocalIP()}:${PORT}`); 