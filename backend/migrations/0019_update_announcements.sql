CREATE TABLE sf_update_announcements (
 id TEXT PRIMARY KEY,
 version TEXT NOT NULL,
 release_date TEXT NOT NULL,
 title TEXT NOT NULL,
 summary TEXT NOT NULL,
 details TEXT NOT NULL CHECK(json_valid(details)),
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE INDEX sf_updates_visible_date ON sf_update_announcements(deleted,release_date DESC);
