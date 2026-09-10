import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import api from "./routes/api.js";
import { hub } from "./ws.js";
import { store } from "./store.js";

const app = new Hono();

app.use("/*", async (c, next) => {
  c.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  c.header("Cross-Origin-Embedder-Policy", "unsafe-none");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  await next();
});

app.route("/api/v1", api);
app.use("/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ path: "./public/index.html" }));

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get("/ws", upgradeWebSocket((c) => {
  const userId = c.req.query("userId") || "";
  const user = store.getOrCreateUser(userId);
  return {
    onOpen(_evt, ws) {
      hub.add(user, ws);
      ws.send(JSON.stringify({
        type: "ready",
        user,
        iceServers: [
          ...(process.env.STUN_URL ? [{ urls: process.env.STUN_URL }] : []),
          ...(process.env.TURN_URL ? [{
            urls: process.env.TURN_URL,
            username: process.env.TURN_USERNAME || "",
            credential: process.env.TURN_CREDENTIAL || ""
          }] : [])
        ]
      }));
    },
    onMessage(evt, ws) {
      try {
        const msg = JSON.parse(evt.data.toString());
        const peerId = typeof msg.peerId === "string" ? msg.peerId : undefined;
        if (peerId) hub.send(peerId, { ...msg, fromUserId: user.id });
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid WebSocket message" }));
      }
    },
    onClose() {
      hub.remove(user.id);
      store.dequeue(user.id);
    }
  };
}));

const port = Number(process.env.PORT || 3000);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`RandomConnect running at http://localhost:${info.port}`);
});
injectWebSocket(server);
