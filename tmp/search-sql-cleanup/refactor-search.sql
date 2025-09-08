-- Refactored search query with consistent enrichment
-- This shows the pattern - we'll implement this in the service

-- The idea:
-- 1. First CTE does the actual search and scoring
-- 2. Second CTE enriches ALL results consistently
-- 3. Final select just formats the output

WITH search_matches AS (
  -- Search shows
  SELECT 
    'show' as entity_type,
    s.id as entity_id,
    s.slug as entity_slug,
    NULL::UUID as track_id,
    ts_rank(s.search_vector, query) as fts_rank,
    similarity(s.search_text, $1) as trgm_sim,
    CASE 
      WHEN s.date = $1 THEN 1.0
      WHEN s.search_text ILIKE '%' || $1 || '%' THEN 0.9
      ELSE 0
    END as exact_score
  FROM shows s,
  plainto_tsquery('english', $1) query
  WHERE 
    (s.search_vector @@ query
     OR similarity(s.search_text, $1) > 0.2
     OR s.date LIKE $1 || '%')
  
  UNION ALL
  
  -- Search tracks
  SELECT 
    'track' as entity_type,
    t.show_id as entity_id,
    t.slug as entity_slug,
    t.id as track_id,
    ts_rank(t.search_vector, query) as fts_rank,
    similarity(t.search_text, $1) as trgm_sim,
    CASE
      WHEN sg.title ILIKE $1 THEN 1.0
      WHEN sg.title ILIKE '%' || $1 || '%' THEN 0.9
      WHEN t.note ILIKE '%' || $1 || '%' THEN 0.8
      WHEN t.search_text ILIKE '%' || $1 || '%' THEN 0.3
      ELSE 0
    END as exact_score
  FROM tracks t
  JOIN songs sg ON t.song_id = sg.id,
  plainto_tsquery('english', $1) query
  WHERE 
    (t.search_vector @@ query
     OR similarity(t.search_text, $1) > 0.2)
),
enriched_results AS (
  SELECT 
    sm.entity_type,
    sm.entity_id,
    sm.entity_slug,
    sm.track_id,
    GREATEST(
      sm.exact_score * 100,
      sm.fts_rank * 60,
      sm.trgm_sim * 100
    )::INTEGER as score,
    -- Show/venue data
    s.date,
    s.slug as show_slug,
    v.name as venue_name,
    v.city as venue_city,
    v.state as venue_state,
    v.country as venue_country,
    -- Track-specific data (will be NULL for shows)
    t.position as track_position,
    t.set as track_set,
    t.note as track_annotation,
    t.segue as track_segue,
    t.is_opener,
    t.is_closer,
    song.title as song_title,
    prev_track.id as prev_track_id,
    prev_song.title as prev_song_title,
    next_track.id as next_track_id,
    next_song.title as next_song_title
  FROM search_matches sm
  -- Always join shows (either directly for show results or via track)
  LEFT JOIN shows s ON 
    CASE 
      WHEN sm.entity_type = 'show' THEN sm.entity_id = s.id
      WHEN sm.entity_type = 'track' THEN sm.entity_id = s.id
    END
  LEFT JOIN venues v ON s.venue_id = v.id
  -- Track-specific joins
  LEFT JOIN tracks t ON sm.track_id = t.id
  LEFT JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks prev_track ON prev_track.next_track_id = t.id
  LEFT JOIN songs prev_song ON prev_track.song_id = prev_song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
)
SELECT 
  entity_type,
  entity_id,
  entity_slug,
  score,
  -- Format date
  TO_CHAR(date::DATE, 'MM/DD/YYYY') as date_str,
  -- Format venue location
  venue_name,
  CASE 
    WHEN venue_city IS NOT NULL AND venue_state IS NOT NULL THEN venue_city || ', ' || venue_state
    WHEN venue_country IS NOT NULL THEN venue_country
    ELSE NULL
  END as venue_location,
  -- Track-specific formatted fields
  song_title,
  track_annotation,
  track_set || CASE 
    WHEN is_opener THEN ' (Opener)'
    WHEN is_closer THEN ' (Closer)'
    ELSE ''
  END as set_info,
  track_position::TEXT,
  prev_song_title,
  next_song_title,
  track_segue,
  -- URL generation
  CASE
    WHEN entity_type = 'show' THEN '/shows/' || show_slug
    WHEN entity_type = 'track' THEN '/tracks/' || entity_id
  END as url
FROM enriched_results
ORDER BY score DESC
LIMIT $2;