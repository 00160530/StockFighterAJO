-- Existing announcements keep their content, publication time and once-only behavior.
ALTER TABLE sf_announcement ADD COLUMN image_url TEXT NOT NULL DEFAULT '' CHECK(length(image_url)<=2048);
ALTER TABLE sf_announcement ADD COLUMN repeat_daily INTEGER NOT NULL DEFAULT 0 CHECK(repeat_daily IN (0,1));
