import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";

const app = new Hono();

const subscribers: ReadableStreamDefaultController[] = [];

app.use(
  cors({
    origin: "*",
  }),
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/event", (c) => {
  // c.header("Content-Type", "text/event-stream");
  // c.header("Cache-Control", "no-cache");
  // c.header("Connection", "keep-alive");

  return streamSSE(c, async (stream) => {
    while (true) {
      const res = await fetch("https://mempool.space/api/v1/prices");

      if (res.ok) {
        const prices = await res.json();

        await stream.writeSSE({
          data: JSON.stringify(prices),
          id: prices.time,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  });
});

app.get("/messages", (c) => {
  const stream = new ReadableStream({
    start(controller) {
      sendEvent(controller, "successful_connection", {
        message: "Connexion établie",
      });

      subscribers.push(controller);

      setInterval(() => {
        controller.enqueue(": heartbeat\n\n");
      }, 15_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

app.post("/messages", async (c) => {
  const message = (await c.req.formData()).get("message");

  for (const sub of subscribers) {
    sendEvent(sub, "message", { message });
  }

  return c.json({ ok: true });
});

const sendEvent = (
  controller: ReadableStreamDefaultController,
  event: string,
  data: any,
) => {
  controller.enqueue(`event: ${event}\n`);
  controller.enqueue(`data: ${JSON.stringify(data)}\n`);
  controller.enqueue(`id: ${new Date().toISOString()}\n\n`);
};

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
