-- Reuse the existing completion table; the session already records the mode.
-- Keep original life completions and backfill only verifiable uploaded games.
INSERT OR IGNORE INTO sf_life_completions(session_id,player_id,outcome,created_at)
 SELECT session_id,player_id,outcome,submitted_at FROM sf_runs
 WHERE mode IN ('life','free');
