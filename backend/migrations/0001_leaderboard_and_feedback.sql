-- Additive migration. Existing tables and data are never dropped.
CREATE TABLE IF NOT EXISTS sf_players (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0 CHECK(banned IN (0,1))
);
CREATE TABLE IF NOT EXISTS sf_sessions (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES sf_players(id),
 run_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 mode TEXT NOT NULL CHECK(mode IN ('life','free')), edition TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 used_at INTEGER, submission_id TEXT,
 UNIQUE(player_id,run_id,edition), CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS sf_sessions_expiry ON sf_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sf_runs (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sf_sessions(id),
 player_id TEXT NOT NULL REFERENCES sf_players(id), edition TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('life','free')),
 nickname TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('won','lost')),
 score INTEGER NOT NULL, equity_cents INTEGER NOT NULL CHECK(equity_cents>0),
 benchmark_cents INTEGER NOT NULL CHECK(benchmark_cents>0),
 drawdown_bps INTEGER NOT NULL CHECK(drawdown_bps BETWEEN 0 AND 10000),
 trades INTEGER NOT NULL CHECK(trades>=0), gain_cents INTEGER, loss_cents INTEGER,
 highlights TEXT NOT NULL, submitted_at INTEGER NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), moderation_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sf_runs_player_edition ON sf_runs(player_id,edition,hidden,score DESC);
CREATE INDEX IF NOT EXISTS sf_runs_recent ON sf_runs(submitted_at DESC,id);
CREATE TABLE IF NOT EXISTS sf_best_scores (
 player_id TEXT NOT NULL REFERENCES sf_players(id), edition TEXT NOT NULL,
 metric TEXT NOT NULL CHECK(metric IN ('alpha','gain','loss')),
 run_id TEXT NOT NULL REFERENCES sf_runs(id), value INTEGER NOT NULL,
 drawdown_bps INTEGER NOT NULL, trades INTEGER NOT NULL, submitted_at INTEGER NOT NULL,
 PRIMARY KEY(player_id,edition,metric)
);
CREATE INDEX IF NOT EXISTS sf_best_ranking ON sf_best_scores(edition,metric,value DESC,drawdown_bps ASC,trades ASC,submitted_at ASC,run_id ASC);
CREATE TABLE IF NOT EXISTS sf_feedback (
 id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES sf_players(id), request_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('wish','problem')), title TEXT NOT NULL,
 body TEXT NOT NULL, steps TEXT NOT NULL DEFAULT '', version TEXT NOT NULL,
 game_date TEXT, mode TEXT CHECK(mode IN ('life','free')),
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','read','planned','done','closed')),
 admin_note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(player_id,request_id)
);
CREATE INDEX IF NOT EXISTS sf_feedback_inbox ON sf_feedback(status,created_at DESC,id);
CREATE INDEX IF NOT EXISTS sf_feedback_created ON sf_feedback(created_at DESC,id);
CREATE TABLE IF NOT EXISTS sf_rate_limits (
 bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sf_rate_expiry ON sf_rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS sf_admin_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
 target_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sf_audit_created ON sf_admin_audit(created_at DESC);
