CREATE TABLE IF NOT EXISTS sf_announcement (
 id INTEGER PRIMARY KEY CHECK (id=1),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 published_at INTEGER NOT NULL,
 updated_by TEXT NOT NULL
);
