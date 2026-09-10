import { nanoid } from "nanoid";

export type User = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  createdAt: string;
  endedAt?: string;
  participantIds: string[];
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  createdAt: string;
};

export type Block = {
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
};

class MemoryStore {
  users = new Map<string, User>();
  conversations = new Map<string, Conversation>();
  messages = new Map<string, Message[]>();
  reports: Report[] = [];
  blocks: Block[] = [];
  queue: string[] = [];

  getOrCreateUser(userId?: string, displayName?: string): User {
    const id = userId || nanoid(12);
    const existing = this.users.get(id);
    if (existing) return existing;
    const user: User = {
      id,
      displayName: displayName?.trim().slice(0, 32) || `Stranger_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString()
    };
    this.users.set(id, user);
    return user;
  }

  updateDisplayName(userId: string, displayName: string) {
    const user = this.getOrCreateUser(userId);
    user.displayName = displayName.trim().slice(0, 32) || user.displayName;
    this.users.set(userId, user);
    return user;
  }

  isBlockedEitherWay(a: string, b: string) {
    return this.blocks.some(
      x => (x.blockerId === a && x.blockedUserId === b) ||
           (x.blockerId === b && x.blockedUserId === a)
    );
  }

  enqueue(userId: string) {
    if (!this.queue.includes(userId)) this.queue.push(userId);
  }

  dequeue(userId: string) {
    this.queue = this.queue.filter(id => id !== userId);
  }

  match(userId: string): string | null {
    this.dequeue(userId);
    const index = this.queue.findIndex(id => id !== userId && !this.isBlockedEitherWay(id, userId));
    if (index < 0) {
      this.enqueue(userId);
      return null;
    }
    const other = this.queue[index];
    this.queue.splice(index, 1);
    return other;
  }

  createConversation(a: string, b: string) {
    const conversation: Conversation = {
      id: nanoid(16),
      createdAt: new Date().toISOString(),
      participantIds: [a, b]
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  addMessage(conversationId: string, senderId: string, body: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || !conversation.participantIds.includes(senderId)) {
      throw new Error("Not a conversation participant");
    }
    const msg: Message = {
      id: nanoid(16),
      conversationId,
      senderId,
      body: body.trim().slice(0, 4000),
      createdAt: new Date().toISOString()
    };
    this.messages.get(conversationId)?.push(msg);
    return msg;
  }

  listConversations(userId: string) {
    return [...this.conversations.values()]
      .filter(c => c.participantIds.includes(userId))
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt))
      .map(c => {
        const otherId = c.participantIds.find(x => x !== userId) || userId;
        const other = this.users.get(otherId);
        const msgs = this.messages.get(c.id) || [];
        return {
          ...c,
          other: other ? { id: other.id, displayName: other.displayName } : null,
          lastMessage: msgs.at(-1) || null
        };
      });
  }

  getConversation(userId: string, conversationId: string) {
    const c = this.conversations.get(conversationId);
    if (!c || !c.participantIds.includes(userId)) return null;
    const otherId = c.participantIds.find(x => x !== userId) || userId;
    return {
      ...c,
      other: this.users.get(otherId) || null,
      messages: this.messages.get(conversationId) || []
    };
  }

  addBlock(blockerId: string, blockedUserId: string) {
    this.blocks = this.blocks.filter(x => !(x.blockerId === blockerId && x.blockedUserId === blockedUserId));
    this.blocks.push({ blockerId, blockedUserId, createdAt: new Date().toISOString() });
    this.dequeue(blockerId);
    this.dequeue(blockedUserId);
  }

  addReport(reporterId: string, reportedUserId: string, reason: string, details?: string) {
    this.reports.push({
      id: nanoid(16),
      reporterId,
      reportedUserId,
      reason,
      details: details?.slice(0, 2000),
      createdAt: new Date().toISOString()
    });
  }
}

export const store = new MemoryStore();
