-- Additive only: existing sessions, scores and credentials are retained.
ALTER TABLE sf_sessions ADD COLUMN start_date TEXT;
ALTER TABLE sf_runs ADD COLUMN start_date TEXT;
ALTER TABLE sf_runs ADD COLUMN early_settlement_date TEXT;
ALTER TABLE sf_runs ADD COLUMN date_jumps TEXT;
