-- Keep existing feedback rows and the original status constraint intact.
ALTER TABLE sf_feedback ADD COLUMN not_handled INTEGER NOT NULL DEFAULT 0 CHECK (not_handled IN (0,1));
CREATE INDEX IF NOT EXISTS sf_feedback_handling ON sf_feedback(not_handled,status,created_at DESC);
CREATE INDEX IF NOT EXISTS sf_runs_admin_status ON sf_runs(hidden,submitted_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS sf_runs_admin_nickname ON sf_runs(nickname COLLATE NOCASE);
