-- Dedicated admin login. Passwords are salted PBKDF2 hashes, never plaintext.
CREATE TABLE IF NOT EXISTS sf_admin_credentials (
 username TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
 iterations INTEGER NOT NULL CHECK(iterations>=100000), updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sf_admin_sessions (
 token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES sf_admin_credentials(username),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sf_admin_session_expiry ON sf_admin_sessions(expires_at);
