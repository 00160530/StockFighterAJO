-- Preserve existing cash-only records and isolate leveraged results by edition.
ALTER TABLE sf_runs ADD COLUMN financing INTEGER NOT NULL DEFAULT 0 CHECK(financing IN (0,1));
ALTER TABLE sf_runs ADD COLUMN margin_summary TEXT NOT NULL DEFAULT '{}';
