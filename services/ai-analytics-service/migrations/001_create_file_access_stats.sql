CREATE TABLE IF NOT EXISTS file_access_stats (
  file_id UUID PRIMARY KEY,
  access_count INT NOT NULL DEFAULT 0,
  first_accessed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
