import { serve, upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer } from "ws";

const app = new Hono();

app.get(
  "/ws",
  upgradeWebSocket(() => {
    return {
      onOpen() {
        console.log("WebSocket connection opened");
      },
      onMessage(event, ws) {
        console.log(`Message from client: ${event.data}`);
        ws.send(event.data.toString());
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

const wss = new WebSocketServer({ noServer: true });

serve(
  {
    fetch: app.fetch,
    port: 3000,
    websocket: { server: wss },
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
