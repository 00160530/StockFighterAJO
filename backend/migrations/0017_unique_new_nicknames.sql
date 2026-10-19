-- Preserve existing identities (including historical duplicates) and all game data.
-- Only new nickname assignments must be unique; ASCII letter case is ignored.
CREATE INDEX sf_players_nickname_lookup ON sf_players(lower(trim(nickname)))
WHERE nickname IS NOT NULL;

CREATE TRIGGER sf_players_nickname_insert
BEFORE INSERT ON sf_players
WHEN NEW.nickname IS NOT NULL AND EXISTS (
 SELECT 1 FROM sf_players
 WHERE nickname IS NOT NULL AND lower(trim(nickname))=lower(trim(NEW.nickname))
)
BEGIN
 SELECT RAISE(ABORT, 'SF_NICKNAME_TAKEN');
END;

CREATE TRIGGER sf_players_nickname_update
BEFORE UPDATE OF nickname ON sf_players
WHEN NEW.nickname IS NOT NULL AND NEW.nickname IS NOT OLD.nickname AND EXISTS (
 SELECT 1 FROM sf_players
 WHERE id<>NEW.id AND nickname IS NOT NULL
 AND lower(trim(nickname))=lower(trim(NEW.nickname))
)
BEGIN
 SELECT RAISE(ABORT, 'SF_NICKNAME_TAKEN');
END;
