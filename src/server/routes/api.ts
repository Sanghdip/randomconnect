import { Hono } from "hono";
import { z } from "zod";
import { store } from "../store.js";
import { hub } from "../ws.js";

const app = new Hono();

const getUserId = (c: any) => c.req.header("x-user-id") || c.req.query("userId") || undefined;

app.get("/health", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.get("/me", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  return c.json(user);
});

app.patch("/me", async (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ displayName: z.string().min(2).max(32) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "displayName must be 2-32 characters" }, 400);
  return c.json(store.updateDisplayName(user.id, parsed.data.displayName));
});

app.post("/matchmaking/join", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  const matchedId = store.match(user.id);
  if (!matchedId) return c.json({ status: "waiting", user });
  const conversation = store.createConversation(user.id, matchedId);
  const peer = store.users.get(matchedId);
  const payload = {
    type: "match_found",
    conversation,
    peer: { id: user.id, displayName: user.displayName }
  };
  hub.send(user.id, payload);
  hub.send(matchedId, { ...payload, peer: { id: matchedId, displayName: peer?.displayName || "Stranger" }});
  hub.assignConversation(user.id, conversation.id);
  hub.assignConversation(matchedId, conversation.id);
  return c.json({ status: "matched", conversation, peer: peer || null });
});

app.post("/matchmaking/leave", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  store.dequeue(user.id);
  return c.json({ ok: true });
});

app.get("/conversations", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  return c.json({ conversations: store.listConversations(user.id) });
});

app.get("/conversations/:id", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  const conversation = store.getConversation(user.id, c.req.param("id"));
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  return c.json(conversation);
});

app.post("/conversations/:id/messages", async (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(body);
  if (!parsed.success) return c.json({ error: "Message body required" }, 400);
  try {
    const msg = store.addMessage(c.req.param("id"), user.id, parsed.data.body);
    const conv = store.conversations.get(msg.conversationId);
    if (conv) hub.sendMany(conv.participantIds.filter(id => id !== user.id), { type: "chat_message", message: msg });
    return c.json({ message: msg }, 201);
  } catch {
    return c.json({ error: "Not authorized for this conversation" }, 403);
  }
});

app.post("/users/:id/block", (c) => {
  const user = store.getOrCreateUser(getUserId(c));
  if (user.id === c.req.param("id")) return c.json({ error: "Cannot block yourself" }, 400);
  store.addBlock(user.id, c.req.param("id"));
  return c.json({ ok: true });
});

app.post("/reports", async (c) => {
  const reporter = store.getOrCreateUser(getUserId(c));
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({
    reportedUserId: z.string().min(1),
    reason: z.enum(["spam", "harassment", "sexual-content", "hate", "violence", "other"]),
    details: z.string().max(2000).optional()
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid report" }, 400);
  store.addReport(reporter.id, parsed.data.reportedUserId, parsed.data.reason, parsed.data.details);
  store.addBlock(reporter.id, parsed.data.reportedUserId);
  return c.json({ ok: true }, 201);
});

export default app;
