-- Keep every historical run intact. Existing identities use their first submitted name,
-- including moderated runs, so moderation cannot unlock a name change.
ALTER TABLE sf_players ADD COLUMN nickname TEXT;
UPDATE sf_players
SET nickname = (
  SELECT r.nickname FROM sf_runs r
  WHERE r.player_id = sf_players.id
  ORDER BY r.submitted_at ASC, r.id ASC LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM sf_runs r WHERE r.player_id = sf_players.id);
