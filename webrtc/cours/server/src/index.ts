import { serve, upgradeWebSocket } from '@hono/node-server'
import { Hono } from 'hono'
import { WebSocketServer } from 'ws';

const app = new Hono()

const wss = new WebSocketServer({ noServer: true });

app.get(
  "/ws",
  upgradeWebSocket(() => {
    return {
      onOpen() {
        console.log("WebSocket connection opened");
      },
      onMessage(event, ws) {
        console.log(`Message from client: ${event.data}`);

        wss.clients.forEach((client) => {
            if (client !== ws.raw && client.readyState === WebSocket.OPEN) {
                client.send(event.data.toString());
            }
        })
      },
      onClose: () => {
        console.log("Connection closed");
      },
      onError: () => {
        console.log("Connection error");
      },
    };
  }),
);

serve({
  fetch: app.fetch,
  port: 3000,
  websocket: { server: wss }
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
