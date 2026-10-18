CREATE TABLE sf_stock_quotes (
 id TEXT PRIMARY KEY,
 player_id TEXT NOT NULL UNIQUE REFERENCES sf_players(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 25),
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 featured_at INTEGER,
 moderation_note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX sf_stock_quotes_latest ON sf_stock_quotes(hidden,created_at DESC,id DESC);
CREATE INDEX sf_stock_quotes_featured ON sf_stock_quotes(hidden,featured,featured_at DESC);
CREATE INDEX IF NOT EXISTS sf_life_completions_player ON sf_life_completions(player_id);
CREATE TABLE sf_stock_quote_likes (
 quote_id TEXT NOT NULL REFERENCES sf_stock_quotes(id),
 player_id TEXT NOT NULL REFERENCES sf_players(id),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(quote_id,player_id)
);
