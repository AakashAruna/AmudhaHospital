const ws = require('ws');

class WebSocketManager {
  constructor() {
    this.clients = new Set();
  }

  init(server) {
    this.wss = new ws.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

      if (pathname === '/ws') {
        this.wss.handleUpgrade(request, socket, head, (wsClient) => {
          this.wss.emit('connection', wsClient, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (socket) => {
      this.clients.add(socket);
      console.log('WebSocket client connected. Total clients:', this.clients.size);

      socket.on('message', (data) => {
        // keepalive or echo logic
      });

      socket.on('close', () => {
        this.clients.delete(socket);
        console.log('WebSocket client disconnected. Total clients:', this.clients.size);
      });

      socket.on('error', (err) => {
        console.error('WebSocket client error:', err);
        this.clients.delete(socket);
      });
    });
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === ws.OPEN) {
        try {
          client.send(payload);
        } catch (err) {
          console.error('Failed to send message to client:', err);
        }
      }
    }
  }
}

const manager = new WebSocketManager();
module.exports = manager;
