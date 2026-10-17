CREATE TABLE IF NOT EXISTS sf_shared_records (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL REFERENCES sf_players(id),
 request_id TEXT NOT NULL,
 record_json TEXT NOT NULL CHECK (json_valid(record_json)),
 created_at INTEGER NOT NULL,
 UNIQUE(player_id,request_id)
);
CREATE INDEX IF NOT EXISTS sf_shared_records_created ON sf_shared_records(created_at DESC);
