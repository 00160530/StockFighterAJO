-- Cosmetic identity is separate from the existing 1..10 mood ID.
-- Existing and older-client scores retain their original Xiao Jiu avatar.
ALTER TABLE sf_runs ADD COLUMN avatar_character TEXT NOT NULL DEFAULT 'xiaojiu'
 CHECK (avatar_character IN ('xiaojiu','xiaoxiaojiu'));
