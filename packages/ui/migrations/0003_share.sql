-- Read-only share links. NULL = not shared.
ALTER TABLE documents ADD COLUMN share_id TEXT;
CREATE UNIQUE INDEX documents_share_id ON documents (share_id);
