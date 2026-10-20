ALTER TABLE sf_stock_quotes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1);

CREATE TABLE sf_stock_quote_revisions (
 quote_id TEXT NOT NULL REFERENCES sf_stock_quotes(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 player_id TEXT NOT NULL,
 body TEXT NOT NULL,
 nickname TEXT NOT NULL,
 avatar_id INTEGER NOT NULL,
 avatar_character TEXT NOT NULL,
 hidden INTEGER NOT NULL,
 featured INTEGER NOT NULL,
 featured_at INTEGER,
 moderation_note TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 replaced_at INTEGER NOT NULL,
 likes INTEGER NOT NULL,
 PRIMARY KEY(quote_id,revision)
);
CREATE INDEX sf_stock_quote_revisions_replaced ON sf_stock_quote_revisions(replaced_at DESC);

-- Archive and replacement are one atomic SQLite statement, including concurrent moderation.
CREATE TRIGGER sf_stock_quote_archive BEFORE UPDATE OF body,avatar_id,avatar_character ON sf_stock_quotes
WHEN OLD.body <> NEW.body OR OLD.avatar_id <> NEW.avatar_id OR OLD.avatar_character <> NEW.avatar_character
BEGIN
 INSERT INTO sf_stock_quote_revisions
 (quote_id,revision,player_id,body,nickname,avatar_id,avatar_character,hidden,featured,featured_at,moderation_note,created_at,updated_at,replaced_at,likes)
 VALUES (OLD.id,OLD.revision,OLD.player_id,OLD.body,OLD.nickname,OLD.avatar_id,OLD.avatar_character,OLD.hidden,OLD.featured,OLD.featured_at,OLD.moderation_note,OLD.created_at,OLD.updated_at,NEW.updated_at,(SELECT COUNT(*) FROM sf_stock_quote_likes WHERE quote_id=OLD.id));
END;
