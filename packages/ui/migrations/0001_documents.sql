-- Files for every app. `owner` is user.id (Better Auth).
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS documents_owner ON documents (owner, kind, updated_at DESC);
