-- Last online is only recorded from authenticated connections after this update.
-- Existing identities stay NULL until they reconnect; do not invent historical dates.
ALTER TABLE sf_players ADD COLUMN last_seen_at INTEGER;
CREATE INDEX IF NOT EXISTS sf_players_last_seen ON sf_players(last_seen_at DESC,id);
CREATE INDEX IF NOT EXISTS sf_players_created ON sf_players(created_at DESC,id);
