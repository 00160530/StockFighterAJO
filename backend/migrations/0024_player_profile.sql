-- Player identity is canonical; quote avatars remain snapshots of each comment.
ALTER TABLE sf_players ADD COLUMN avatar_id INTEGER NOT NULL DEFAULT 1 CHECK(avatar_id BETWEEN 1 AND 10);
ALTER TABLE sf_players ADD COLUMN avatar_character TEXT NOT NULL DEFAULT 'xiaojiu' CHECK(avatar_character IN ('xiaojiu','xiaoxiaojiu'));
UPDATE sf_players SET
 avatar_id=COALESCE((SELECT r.avatar_id FROM sf_runs r WHERE r.player_id=sf_players.id AND r.hidden=0 ORDER BY r.submitted_at DESC,r.id DESC LIMIT 1),1),
 avatar_character=COALESCE((SELECT r.avatar_character FROM sf_runs r WHERE r.player_id=sf_players.id AND r.hidden=0 ORDER BY r.submitted_at DESC,r.id DESC LIMIT 1),'xiaojiu');
DROP INDEX sf_runs_admin_nickname;
ALTER TABLE sf_runs DROP COLUMN nickname;
ALTER TABLE sf_runs DROP COLUMN avatar_id;
ALTER TABLE sf_runs DROP COLUMN avatar_character;
