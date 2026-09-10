import type { WSContext } from "hono/ws";
import type { Conversation, User } from "./store.js";

type Client = { user: User; ws: WSContext; conversationId?: string };

export class SocketHub {
  private clients = new Map<string, Client>();

  add(user: User, ws: WSContext) {
    this.clients.set(user.id, { user, ws });
  }

  remove(userId: string) {
    this.clients.delete(userId);
  }

  get(userId: string) {
    return this.clients.get(userId);
  }

  send(userId: string, payload: unknown) {
    const client = this.clients.get(userId);
    if (client) client.ws.send(JSON.stringify(payload));
  }

  sendMany(userIds: string[], payload: unknown) {
    for (const id of userIds) this.send(id, payload);
  }

  assignConversation(userId: string, conversationId: string) {
    const client = this.clients.get(userId);
    if (client) client.conversationId = conversationId;
  }
}

export const hub = new SocketHub();
