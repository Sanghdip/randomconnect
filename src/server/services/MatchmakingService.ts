export type MatchMode = "text" | "video";

export interface QueueEntry {
  id: string;
  userId: string;
  mode: MatchMode;
  joinedAt: number;
}

/**
 * Runtime adapter interface.
 * Implement these methods with the target D1 binding.
 */
export interface MatchmakingStore {
  findWaitingOpponent(userId: string, mode: MatchMode): Promise<QueueEntry | null>;
  enqueue(entry: QueueEntry): Promise<void>;
  remove(id: string): Promise<void>;
  areBlocked(a: string, b: string): Promise<boolean>;
  createConversation(a: string, b: string, mode: MatchMode): Promise<{
    conversationId: string;
    roomId: string;
  }>;
}

export class MatchmakingService {
  constructor(private readonly store: MatchmakingStore) {}

  async join(userId: string, mode: MatchMode) {
    const opponent = await this.store.findWaitingOpponent(userId, mode);

    if (opponent && !(await this.store.areBlocked(userId, opponent.userId))) {
      await this.store.remove(opponent.id);
      return this.store.createConversation(userId, opponent.userId, mode);
    }

    const entry: QueueEntry = {
      id: crypto.randomUUID(),
      userId,
      mode,
      joinedAt: Date.now()
    };

    await this.store.enqueue(entry);
    return { waiting: true, queueId: entry.id };
  }
}
