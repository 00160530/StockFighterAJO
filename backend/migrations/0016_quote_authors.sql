ALTER TABLE sf_stock_quotes ADD COLUMN nickname TEXT NOT NULL DEFAULT '匿名股友' CHECK(length(nickname) BETWEEN 2 AND 20);
ALTER TABLE sf_stock_quotes ADD COLUMN avatar_id INTEGER NOT NULL DEFAULT 1 CHECK(avatar_id BETWEEN 1 AND 10);
ALTER TABLE sf_stock_quotes ADD COLUMN avatar_character TEXT NOT NULL DEFAULT 'xiaojiu' CHECK(avatar_character IN ('xiaojiu','xiaoxiaojiu'));
UPDATE sf_stock_quotes SET nickname=COALESCE((SELECT nickname FROM sf_players WHERE id=sf_stock_quotes.player_id),'匿名股友');
