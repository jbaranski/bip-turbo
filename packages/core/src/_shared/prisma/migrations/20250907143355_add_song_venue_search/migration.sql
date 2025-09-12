-- Add search fields to songs table
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS search_text TEXT,
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search fields to venues table  
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS search_text TEXT,
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Function to build song search text
CREATE OR REPLACE FUNCTION build_song_search_text(p_song_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT 
    COALESCE(s.title, '') || ' ' ||
    COALESCE(s.legacy_author, '') || ' ' ||
    COALESCE(s.featured_lyric, '') || ' ' ||
    COALESCE(s.notes, '') || ' ' ||
    CASE WHEN s.cover = true THEN 'cover' ELSE '' END
  INTO result
  FROM songs s
  WHERE s.id = p_song_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to build venue search text
CREATE OR REPLACE FUNCTION build_venue_search_text(p_venue_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT 
    COALESCE(v.name, '') || ' ' ||
    COALESCE(v.city, '') || ' ' ||
    COALESCE(v.state, '') || ' ' ||
    COALESCE(v.country, '') || ' ' ||
    COALESCE(v.street, '')
  INTO result
  FROM venues v
  WHERE v.id = p_venue_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for songs
CREATE OR REPLACE FUNCTION update_song_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_song_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for venues
CREATE OR REPLACE FUNCTION update_venue_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_venue_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for songs
DROP TRIGGER IF EXISTS trigger_update_song_search_fields ON songs;
CREATE TRIGGER trigger_update_song_search_fields
BEFORE INSERT OR UPDATE ON songs
FOR EACH ROW
EXECUTE FUNCTION update_song_search_fields();

-- Create triggers for venues
DROP TRIGGER IF EXISTS trigger_update_venue_search_fields ON venues;
CREATE TRIGGER trigger_update_venue_search_fields
BEFORE INSERT OR UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION update_venue_search_fields();

-- Create indexes for song search
CREATE INDEX IF NOT EXISTS idx_songs_search_vector ON songs USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_songs_search_text_trgm ON songs USING gin(search_text gin_trgm_ops);

-- Create indexes for venue search
CREATE INDEX IF NOT EXISTS idx_venues_search_vector ON venues USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_venues_search_text_trgm ON venues USING gin(search_text gin_trgm_ops);

-- Search function for songs
CREATE OR REPLACE FUNCTION search_songs(query TEXT, max_results INTEGER DEFAULT 10)
RETURNS TABLE(
  song_id UUID,
  song_title TEXT,
  song_slug TEXT,
  match_score INTEGER,
  times_played INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH search_matches AS (
    SELECT 
      s.id,
      s.title,
      s.slug,
      ts_rank(s.search_vector, plainto_tsquery('english', query)) as fts_rank,
      similarity(s.search_text, query) as trgm_sim,
      CASE 
        WHEN LOWER(s.title) = LOWER(query) THEN 1.0
        WHEN LOWER(s.title) LIKE LOWER(query) || '%' THEN 0.9
        WHEN LOWER(s.title) LIKE '%' || LOWER(query) || '%' THEN 0.8
        ELSE 0
      END as exact_score,
      s.times_played
    FROM songs s
    WHERE 
      s.search_vector @@ plainto_tsquery('english', query)
      OR similarity(s.search_text, query) > 0.2
      OR LOWER(s.title) LIKE '%' || LOWER(query) || '%'
  )
  SELECT 
    id,
    title::TEXT,
    slug::TEXT,
    GREATEST(
      exact_score * 100,
      fts_rank * 60,
      trgm_sim * 100
    )::INTEGER as score,
    times_played
  FROM search_matches
  ORDER BY score DESC, times_played DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Search function for venues
CREATE OR REPLACE FUNCTION search_venues(query TEXT, max_results INTEGER DEFAULT 10)
RETURNS TABLE(
  venue_id UUID,
  venue_name TEXT,
  venue_slug TEXT,
  venue_city TEXT,
  venue_state TEXT,
  venue_country TEXT,
  match_score INTEGER,
  times_played INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH search_matches AS (
    SELECT 
      v.id,
      v.name,
      v.slug,
      v.city,
      v.state,
      v.country,
      ts_rank(v.search_vector, plainto_tsquery('english', query)) as fts_rank,
      similarity(v.search_text, query) as trgm_sim,
      CASE 
        WHEN LOWER(v.name) = LOWER(query) THEN 1.0
        WHEN LOWER(v.name) LIKE LOWER(query) || '%' THEN 0.9
        WHEN LOWER(v.name) LIKE '%' || LOWER(query) || '%' THEN 0.8
        WHEN LOWER(v.city) = LOWER(query) THEN 0.7
        WHEN LOWER(v.city) LIKE '%' || LOWER(query) || '%' THEN 0.6
        ELSE 0
      END as exact_score,
      v.times_played
    FROM venues v
    WHERE 
      v.search_vector @@ plainto_tsquery('english', query)
      OR similarity(v.search_text, query) > 0.2
      OR LOWER(v.name) LIKE '%' || LOWER(query) || '%'
      OR LOWER(v.city) LIKE '%' || LOWER(query) || '%'
  )
  SELECT 
    id,
    name::TEXT,
    slug::TEXT,
    city::TEXT,
    state::TEXT,
    country::TEXT,
    GREATEST(
      exact_score * 100,
      fts_rank * 60,
      trgm_sim * 100
    )::INTEGER as score,
    times_played
  FROM search_matches
  ORDER BY score DESC, times_played DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Backfill search data for all songs
UPDATE songs SET 
  search_text = build_song_search_text(id),
  search_vector = to_tsvector('english', build_song_search_text(id));

-- Backfill search data for all venues
UPDATE venues SET 
  search_text = build_venue_search_text(id),
  search_vector = to_tsvector('english', build_venue_search_text(id));