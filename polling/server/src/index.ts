import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { tictactoe } from "./tictactoe.js";

type Message = {
  id: number;
  content: string;
};

const messages: Message[] = [];
const pendingResponses: ((message: Message) => void)[] = [];

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

  pendingResponses.forEach(async (res, index) => {
    res(message);
    delete pendingResponses[index];
  });

  c.status(201);
  return c.json(message);
});

app.get("/messages/subscribe", (c) => {
  c.header("Connection", "Keep-Alive");
  c.header("Keep-Alive", "timeout=60, max=1000");

  return new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(null, {
          status: 204,
        }),
      );
    }, 60_000);

    const messageSent = (message: Message) => {
      resolve(new Response(JSON.stringify(message)));
    };
    pendingResponses.push(messageSent);
  });
});

app.route("/", tictactoe);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
