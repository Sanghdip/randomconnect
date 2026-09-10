CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_participants_user
ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_reports_reported
ON reports(reported_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_queue_joined
ON matchmaking_queue(joined_at);
