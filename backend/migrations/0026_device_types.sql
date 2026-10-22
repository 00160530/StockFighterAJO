-- Additive only: historical devices are unknown and must not be guessed.
ALTER TABLE sf_players ADD COLUMN last_device_type TEXT NOT NULL DEFAULT 'unknown' CHECK(last_device_type IN ('mobile','desktop','tablet','unknown'));
ALTER TABLE sf_runs ADD COLUMN device_type TEXT NOT NULL DEFAULT 'unknown' CHECK(device_type IN ('mobile','desktop','tablet','unknown'));
