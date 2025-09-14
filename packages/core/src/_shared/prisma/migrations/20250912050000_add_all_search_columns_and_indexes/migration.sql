-- Add search columns to all tables
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "search_text" TEXT;
ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "search_text" TEXT;
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "search_text" TEXT;
ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "search_text" TEXT;
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create basic index
CREATE INDEX IF NOT EXISTS "shows_date_idx" ON "shows"("date");

-- Create search indexes
CREATE INDEX IF NOT EXISTS "shows_search_vector_idx" ON "shows" USING GIN("search_vector");
CREATE INDEX IF NOT EXISTS "tracks_search_vector_idx" ON "tracks" USING GIN("search_vector");
CREATE INDEX IF NOT EXISTS "songs_search_vector_idx" ON "songs" USING GIN("search_vector");
CREATE INDEX IF NOT EXISTS "venues_search_vector_idx" ON "venues" USING GIN("search_vector");

CREATE INDEX IF NOT EXISTS "shows_search_text_trgm_idx" ON "shows" USING GIN("search_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tracks_search_text_trgm_idx" ON "tracks" USING GIN("search_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "songs_search_text_trgm_idx" ON "songs" USING GIN("search_text" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "venues_search_text_trgm_idx" ON "venues" USING GIN("search_text" gin_trgm_ops);