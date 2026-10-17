-- Additive migration: existing scores keep unknown time / skill statistics.
ALTER TABLE sf_runs ADD COLUMN play_time_ms INTEGER CHECK (play_time_ms IS NULL OR play_time_ms >= 0);
ALTER TABLE sf_runs ADD COLUMN play_time_partial INTEGER NOT NULL DEFAULT 0 CHECK (play_time_partial IN (0,1));
ALTER TABLE sf_runs ADD COLUMN skill_uses TEXT;
