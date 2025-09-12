-- Enhance search_shows_with_songs_v3 to highlight matched songs
DROP FUNCTION IF EXISTS search_shows_with_songs_v3(TEXT[], BOOLEAN, UUID[], UUID[]);

CREATE OR REPLACE FUNCTION search_shows_with_songs_v3(
  search_songs TEXT[], 
  is_segue BOOLEAN DEFAULT FALSE,
  song_ids UUID[] DEFAULT NULL,
  venue_ids UUID[] DEFAULT NULL
) 
RETURNS TABLE(
  show_id UUID,
  show_slug TEXT,
  show_date TEXT,
  venue_name TEXT,
  venue_city TEXT,
  venue_state TEXT,
  venue_country TEXT,
  match_score INTEGER,
  match_details TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH track_positions AS (
    -- Get all tracks with their positions and song titles
    SELECT 
      t.show_id,
      t.id as track_id,
      t.position,
      t.set,
      s.title as song_title,
      t.segue,
      t.next_track_id,
      LOWER(s.title) as song_lower,
      s.id as song_id
    FROM tracks t
    JOIN songs s ON t.song_id = s.id
  ),
  matched_tracks AS (
    -- Find tracks matching our search songs or exact song IDs
    SELECT 
      tp.show_id,
      tp.track_id,
      tp.position,
      tp.set,
      tp.song_title,
      tp.segue,
      tp.next_track_id,
      tp.song_lower,
      tp.song_id,
      -- Score higher for exact song ID matches
      CASE 
        WHEN song_ids IS NOT NULL AND tp.song_id = ANY(song_ids) THEN 100
        WHEN EXISTS (
          SELECT 1 FROM unnest(search_songs) AS ss
          WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
        ) THEN 50
        ELSE 0
      END as song_match_score,
      -- Mark if this is an exact song ID match for highlighting
      CASE 
        WHEN song_ids IS NOT NULL AND tp.song_id = ANY(song_ids) THEN true
        ELSE false
      END as is_exact_song_match
    FROM track_positions tp
    WHERE 
      -- Match exact song IDs if provided
      (song_ids IS NOT NULL AND tp.song_id = ANY(song_ids))
      OR
      -- Otherwise use text matching
      (song_ids IS NULL AND EXISTS (
        SELECT 1 FROM unnest(search_songs) AS ss
        WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
      ))
  ),
  venue_matched_shows AS (
    -- Find shows at specific venues or matching venue text
    SELECT DISTINCT
      s.id as show_id,
      CASE 
        WHEN venue_ids IS NOT NULL AND s.venue_id = ANY(venue_ids) THEN 100
        ELSE 50
      END as venue_match_score
    FROM shows s
    LEFT JOIN venues v ON s.venue_id = v.id
    WHERE 
      -- Match exact venue IDs if provided
      (venue_ids IS NOT NULL AND s.venue_id = ANY(venue_ids))
      OR
      -- Otherwise skip venue filtering for now
      (venue_ids IS NULL)
  ),
  segue_matches AS (
    -- Find actual segue occurrences when searching for segues
    SELECT DISTINCT
      mt1.show_id AS match_show_id,
      mt1.position AS start_pos,
      mt2.position AS end_pos,
      mt1.set,
      mt1.song_title || ' > ' || mt2.song_title as segue_text,
      -- Higher score for exact song ID matches in segues
      CASE 
        WHEN mt1.song_match_score = 100 AND mt2.song_match_score = 100 THEN 150
        WHEN mt1.song_match_score = 100 OR mt2.song_match_score = 100 THEN 120
        ELSE 100
      END as segue_score
    FROM matched_tracks mt1
    JOIN matched_tracks mt2 ON mt1.next_track_id = mt2.track_id
    WHERE mt1.segue = '>'
      AND mt1.show_id = mt2.show_id
      AND is_segue 
      AND array_length(search_songs, 1) = 2
      AND (
        -- Either exact song IDs match the segue order
        (song_ids IS NOT NULL AND array_length(song_ids, 1) = 2 
         AND mt1.song_id = song_ids[1] AND mt2.song_id = song_ids[2])
        OR
        -- Or text matches
        (mt1.song_lower LIKE '%' || LOWER(search_songs[1]) || '%'
         AND mt2.song_lower LIKE '%' || LOWER(search_songs[2]) || '%')
      )
  ),
  show_matches AS (
    SELECT 
      COALESCE(sm.match_show_id, mt.show_id) AS match_show_id,
      CASE 
        WHEN sm.match_show_id IS NOT NULL THEN 
          -- Segue match score + venue bonus
          sm.segue_score + COALESCE(vms.venue_match_score / 2, 0)
        ELSE 
          -- Regular track match score + venue bonus
          GREATEST(50, MAX(mt.song_match_score)) + COALESCE(vms.venue_match_score / 2, 0)
      END as proximity_score,
      COALESCE(
        sm.set || ': ' || sm.segue_text,
        -- For regular matches, highlight exact song matches and show context
        STRING_AGG(
          CASE 
            WHEN mt.is_exact_song_match THEN mt.song_title  -- Highlight exact matches
            ELSE mt.song_title
          END ||
          CASE 
            WHEN mt.position = 1 THEN ' (Opener)'
            WHEN mt.next_track_id IS NULL THEN ' (Closer)'
            ELSE ''
          END,
          ', ' ORDER BY mt.position, mt.song_title
        )
      ) as match_details
    FROM matched_tracks mt
    LEFT JOIN segue_matches sm ON mt.show_id = sm.match_show_id
    LEFT JOIN venue_matched_shows vms ON 
      COALESCE(sm.match_show_id, mt.show_id) = vms.show_id
    WHERE is_segue = false OR sm.match_show_id IS NOT NULL
    GROUP BY sm.match_show_id, mt.show_id, sm.set, sm.segue_text, sm.segue_score, vms.venue_match_score
  )
  SELECT 
    sm.match_show_id,
    sh.slug::TEXT,
    sh.date::TEXT,
    v.name::TEXT,
    v.city::TEXT,
    v.state::TEXT,
    v.country::TEXT,
    sm.proximity_score::INTEGER,
    sm.match_details::TEXT
  FROM show_matches sm
  JOIN shows sh ON sm.match_show_id = sh.id
  LEFT JOIN venues v ON sh.venue_id = v.id
  ORDER BY sm.proximity_score DESC, sh.date DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;