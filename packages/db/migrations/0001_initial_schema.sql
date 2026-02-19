-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  created_by  TEXT,  -- Supabase Auth user ID
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_product_id_idx ON documents(product_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status);

-- ─── chunks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(1024),  -- Voyage AI voyage-3 dimensions
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_product_id_idx ON chunks(product_id);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- IVFFlat index for fast approximate nearest-neighbor search
-- Run after data is loaded: CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── match_chunks RPC function ────────────────────────────────────────────────
-- Called by the RAG pipeline to find relevant chunks for a product.
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding   VECTOR(1024),
  product_id_filter UUID,
  match_count       INT DEFAULT 5,
  match_threshold   FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  product_id  UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.product_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE
    c.product_id = product_id_filter
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by backend / Inngest jobs)
-- Authenticated users can read products and chunks (for the Slack bot service account)
CREATE POLICY "service_role_all_products"  ON products  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_documents" ON documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_chunks"    ON chunks    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_products"  ON products  FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_chunks"    ON chunks    FOR SELECT TO anon USING (true);
