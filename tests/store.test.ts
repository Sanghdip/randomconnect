import { describe, expect, it } from "vitest";
import { store } from "../src/server/store.js";

describe("RandomConnect store", () => {
  it("matches two available users", () => {
    const a = store.getOrCreateUser(undefined, "Alice");
    const b = store.getOrCreateUser(undefined, "Bob");
    store.enqueue(a.id);
    const matched = store.match(b.id);
    expect(matched).toBe(a.id);
  });

  it("persists conversation messages in the local development store", () => {
    const a = store.getOrCreateUser(undefined, "A");
    const b = store.getOrCreateUser(undefined, "B");
    const c = store.createConversation(a.id, b.id);
    const msg = store.addMessage(c.id, a.id, "hello");
    expect(store.getConversation(b.id, c.id)?.messages[0].body).toBe("hello");
    expect(msg.senderId).toBe(a.id);
  });
});
