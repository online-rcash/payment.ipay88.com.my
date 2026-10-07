-- Run once on the existing AUTH_DB. CREATE IF NOT EXISTS preserves existing data.
CREATE TABLE IF NOT EXISTS email_otp_challenges (
  email TEXT PRIMARY KEY, challenge_id TEXT UNIQUE NOT NULL, otp_mac TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0, cancelled INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL, mailjet_message_id TEXT
);
CREATE TABLE IF NOT EXISTS email_auth_sessions (
  token_hash TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, email TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_auth_users (email TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS email_auth_rate_limits (
  bucket_key TEXT NOT NULL, window_start INTEGER NOT NULL, hits INTEGER NOT NULL,
  PRIMARY KEY(bucket_key, window_start)
);
CREATE TABLE IF NOT EXISTS email_auth_outbox (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL, locked_until INTEGER NOT NULL DEFAULT 0, mailjet_message_id TEXT,
  UNIQUE(email, kind)
);
CREATE TABLE IF NOT EXISTS email_magic_links (
  email TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, token_hash TEXT UNIQUE NOT NULL, origin TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_magic_sessions (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
