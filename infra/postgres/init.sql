CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agent_runs (
  run_id text PRIMARY KEY,
  inbox_item_id text NOT NULL,
  generation_mode text NOT NULL,
  llm_provider text NOT NULL,
  llm_model text NOT NULL,
  llm_configured boolean NOT NULL,
  fallback_reason text,
  action_card jsonb NOT NULL,
  agent_steps jsonb NOT NULL,
  evidence_items jsonb NOT NULL,
  calendar_availability jsonb,
  critic_report jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_inbox_item_created_at
  ON agent_runs (inbox_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_items (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  snippet text NOT NULL,
  relevance_score double precision NOT NULL,
  used_for text NOT NULL,
  chunk_id text NOT NULL,
  embedding vector(768) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_embedding
  ON evidence_items USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  calendar_id text NOT NULL,
  title text NOT NULL,
  start_at timestamp NOT NULL,
  end_at timestamp NOT NULL,
  location text,
  source text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range
  ON calendar_events (start_at, end_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  code_verifier text,
  created_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_provider_created_at
  ON oauth_states (provider, created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_connections (
  provider text PRIMARY KEY,
  token_json jsonb NOT NULL,
  scopes jsonb NOT NULL,
  expires_at timestamptz,
  connected_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
