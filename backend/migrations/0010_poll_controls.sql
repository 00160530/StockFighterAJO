ALTER TABLE sf_polls ADD COLUMN red_label TEXT NOT NULL DEFAULT '行' CHECK(length(red_label) BETWEEN 1 AND 12);
ALTER TABLE sf_polls ADD COLUMN green_label TEXT NOT NULL DEFAULT '不行' CHECK(length(green_label) BETWEEN 1 AND 12);
ALTER TABLE sf_polls ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS sf_polls_available ON sf_polls(deleted_at,visible,created_at DESC);
