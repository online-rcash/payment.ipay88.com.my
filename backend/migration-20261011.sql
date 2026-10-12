
-- Additive migration: existing accounts and sessions are preserved.
CREATE TABLE IF NOT EXISTS email_auth_challenge_context (
  challenge_id TEXT PRIMARY KEY, intent TEXT NOT NULL CHECK(intent IN ('login', 'register')),
  full_name TEXT, mykad TEXT, phone TEXT, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_auth_profiles (
  email TEXT PRIMARY KEY REFERENCES email_auth_users(email),
  full_name TEXT NOT NULL, mykad TEXT NOT NULL, phone TEXT NOT NULL
);
