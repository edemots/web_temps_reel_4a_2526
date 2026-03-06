import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

type Message = {
  id: number;
  content: string;
};

const messages: Message[] = [];

const app = new Hono();
app.use(
  cors({
    origin: "*",
  }),
);

app.get("/messages", (c) => {
  return c.json(messages);
});

app.post("/messages", async (c) => {
  const body = await c.req.formData();
  const message = {
    id: Date.now(),
    content: body.get("message") as string,
  } satisfies Message;

  messages.push(message);

  c.status(201);
  return c.json(message);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
