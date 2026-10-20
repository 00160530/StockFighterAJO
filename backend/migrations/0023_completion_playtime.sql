-- Historical completions intentionally remain unknown; do not infer or backfill.
ALTER TABLE sf_life_completions ADD COLUMN play_time_ms INTEGER
 CHECK (play_time_ms IS NULL OR (typeof(play_time_ms)='integer' AND play_time_ms>=0));
ALTER TABLE sf_life_completions ADD COLUMN play_time_partial INTEGER
 CHECK (play_time_partial IS NULL OR play_time_partial IN (0,1));
