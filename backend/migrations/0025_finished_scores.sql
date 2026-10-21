-- D1 supports deferred foreign keys for a table rebuild. Preserve every key,
-- original value and row order; permit verified bankruptcy assets without rounding.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE sf_runs_next (
 id TEXT PRIMARY KEY,session_id TEXT NOT NULL UNIQUE REFERENCES sf_sessions(id),
 player_id TEXT NOT NULL REFERENCES sf_players(id),edition TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('life','free')),
 outcome TEXT NOT NULL CHECK(outcome IN ('won','lost')),
 score INTEGER NOT NULL,equity_cents INTEGER NOT NULL,
 benchmark_cents INTEGER NOT NULL CHECK(benchmark_cents>0),
 drawdown_bps INTEGER NOT NULL CHECK(drawdown_bps BETWEEN 0 AND 10000),
 trades INTEGER NOT NULL CHECK(trades>=0),gain_cents INTEGER,loss_cents INTEGER,
 highlights TEXT NOT NULL,submitted_at INTEGER NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),moderation_note TEXT NOT NULL DEFAULT '',
 financing INTEGER NOT NULL DEFAULT 0 CHECK(financing IN (0,1)),margin_summary TEXT NOT NULL DEFAULT '{}',
 play_time_ms INTEGER CHECK(play_time_ms IS NULL OR play_time_ms>=0),
 play_time_partial INTEGER NOT NULL DEFAULT 0 CHECK(play_time_partial IN (0,1)),skill_uses TEXT,
 start_date TEXT,early_settlement_date TEXT,date_jumps TEXT,
 finish_status TEXT CHECK(finish_status IS NULL OR finish_status IN ('won','lost','bankrupt')),
 upload_receipt TEXT
);
CREATE TABLE sf_runs_preserved AS SELECT rowid AS _source_rowid,* FROM sf_runs;
DROP TABLE sf_runs;
ALTER TABLE sf_runs_next RENAME TO sf_runs;
INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,loss_cents,highlights,submitted_at,hidden,moderation_note,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,start_date,early_settlement_date,date_jumps)
 SELECT id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,loss_cents,highlights,submitted_at,hidden,moderation_note,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,start_date,early_settlement_date,date_jumps FROM sf_runs_preserved ORDER BY _source_rowid;
DROP TABLE sf_runs_preserved;
CREATE INDEX sf_runs_player_edition ON sf_runs(player_id,edition,hidden,score DESC);
CREATE INDEX sf_runs_recent ON sf_runs(submitted_at DESC,id);
CREATE INDEX sf_runs_admin_status ON sf_runs(hidden,submitted_at DESC,id DESC);
CREATE INDEX sf_runs_outcome_ranking ON sf_runs(edition,outcome,hidden,player_id,equity_cents DESC,gain_cents DESC,trades,submitted_at,id);
