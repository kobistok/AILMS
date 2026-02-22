-- Add content categories to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS categories TEXT NOT NULL DEFAULT '[]';
