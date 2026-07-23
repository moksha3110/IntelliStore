CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS storage_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  bucket TEXT NOT NULL UNIQUE,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at TIMESTAMPTZ,
  capacity_bytes BIGINT NOT NULL DEFAULT 10737418240,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunk_replicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL,
  node_id UUID NOT NULL REFERENCES storage_nodes (id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'degraded', 'lost')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_chunk_replicas_chunk_id ON chunk_replicas (chunk_id);

-- Simulated storage nodes: distinct MinIO buckets standing in for physically
-- separate nodes, since this project runs against a single MinIO instance.
INSERT INTO storage_nodes (name, bucket) VALUES
  ('node-1', 'intellistore-node-1'),
  ('node-2', 'intellistore-node-2'),
  ('node-3', 'intellistore-node-3')
ON CONFLICT (name) DO NOTHING;
