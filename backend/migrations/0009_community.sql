CREATE TABLE IF NOT EXISTS sf_life_completions (
 session_id TEXT PRIMARY KEY REFERENCES sf_sessions(id),
 player_id TEXT NOT NULL REFERENCES sf_players(id),
 outcome TEXT NOT NULL CHECK(outcome IN ('won','lost')),
 created_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO sf_life_completions(session_id,player_id,outcome,created_at)
 SELECT session_id,player_id,outcome,submitted_at FROM sf_runs WHERE mode='life';
CREATE TABLE IF NOT EXISTS sf_polls (
 id TEXT PRIMARY KEY,
 question TEXT NOT NULL CHECK(length(question) BETWEEN 1 AND 120),
 active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
 visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 CHECK(active=0 OR visible=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS sf_polls_one_active ON sf_polls(active) WHERE active=1;
CREATE TABLE IF NOT EXISTS sf_poll_votes (
 poll_id TEXT NOT NULL REFERENCES sf_polls(id),
 player_id TEXT NOT NULL REFERENCES sf_players(id),
 choice TEXT NOT NULL CHECK(choice IN ('yes','no')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(poll_id,player_id)
);
CREATE INDEX IF NOT EXISTS sf_poll_votes_count ON sf_poll_votes(poll_id,choice);
CREATE TRIGGER IF NOT EXISTS sf_poll_question_locked
 BEFORE UPDATE OF question ON sf_polls
 WHEN NEW.question<>OLD.question AND EXISTS(SELECT 1 FROM sf_poll_votes WHERE poll_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'A voted poll question cannot be changed'); END;
CREATE TABLE IF NOT EXISTS sf_community_counters (
 id INTEGER PRIMARY KEY CHECK(id=1),
 total_adjustment INTEGER NOT NULL DEFAULT 0,
 wins_adjustment INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
