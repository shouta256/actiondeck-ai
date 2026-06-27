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
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_inbox_item_created_at
  ON agent_runs (inbox_item_id, created_at DESC);
