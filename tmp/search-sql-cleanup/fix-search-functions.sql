-- Fix ambiguous column reference in search functions
DROP FUNCTION IF EXISTS search_songs(TEXT, INTEGER);
DROP FUNCTION IF EXISTS search_venues(TEXT, INTEGER);

-- Search function for songs (fixed)
CREATE OR REPLACE FUNCTION search_songs(p_query TEXT, p_max_results INTEGER DEFAULT 10)
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
      ts_rank(s.search_vector, plainto_tsquery('english', p_query)) as fts_rank,
      similarity(s.search_text, p_query) as trgm_sim,
      CASE 
        WHEN LOWER(s.title) = LOWER(p_query) THEN 1.0
        WHEN LOWER(s.title) LIKE LOWER(p_query) || '%' THEN 0.9
        WHEN LOWER(s.title) LIKE '%' || LOWER(p_query) || '%' THEN 0.8
        ELSE 0
      END as exact_score,
      s.times_played
    FROM songs s
    WHERE 
      s.search_vector @@ plainto_tsquery('english', p_query)
      OR similarity(s.search_text, p_query) > 0.2
      OR LOWER(s.title) LIKE '%' || LOWER(p_query) || '%'
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
    search_matches.times_played
  FROM search_matches
  ORDER BY score DESC, search_matches.times_played DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Search function for venues (fixed)
CREATE OR REPLACE FUNCTION search_venues(p_query TEXT, p_max_results INTEGER DEFAULT 10)
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
      ts_rank(v.search_vector, plainto_tsquery('english', p_query)) as fts_rank,
      similarity(v.search_text, p_query) as trgm_sim,
      CASE 
        WHEN LOWER(v.name) = LOWER(p_query) THEN 1.0
        WHEN LOWER(v.name) LIKE LOWER(p_query) || '%' THEN 0.9
        WHEN LOWER(v.name) LIKE '%' || LOWER(p_query) || '%' THEN 0.8
        WHEN LOWER(v.city) = LOWER(p_query) THEN 0.7
        WHEN LOWER(v.city) LIKE '%' || LOWER(p_query) || '%' THEN 0.6
        ELSE 0
      END as exact_score,
      v.times_played
    FROM venues v
    WHERE 
      v.search_vector @@ plainto_tsquery('english', p_query)
      OR similarity(v.search_text, p_query) > 0.2
      OR LOWER(v.name) LIKE '%' || LOWER(p_query) || '%'
      OR LOWER(v.city) LIKE '%' || LOWER(p_query) || '%'
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
    search_matches.times_played
  FROM search_matches
  ORDER BY score DESC, search_matches.times_played DESC
  LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;