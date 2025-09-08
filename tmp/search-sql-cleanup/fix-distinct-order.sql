-- Fix the DISTINCT ORDER BY issue in search function
DROP FUNCTION IF EXISTS search_shows_with_songs_v2(TEXT[], BOOLEAN);

CREATE OR REPLACE FUNCTION search_shows_with_songs_v2(
  search_songs TEXT[], 
  is_segue BOOLEAN DEFAULT FALSE
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
      LOWER(s.title) as song_lower
    FROM tracks t
    JOIN songs s ON t.song_id = s.id
  ),
  matched_tracks AS (
    -- Find tracks matching our search songs
    SELECT 
      tp.show_id,
      tp.track_id,
      tp.position,
      tp.set,
      tp.song_title,
      tp.segue,
      tp.next_track_id,
      tp.song_lower
    FROM track_positions tp
    WHERE EXISTS (
      SELECT 1 FROM unnest(search_songs) AS ss
      WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
    )
  ),
  segue_matches AS (
    -- Find actual segue occurrences when searching for segues
    SELECT DISTINCT
      mt1.show_id AS match_show_id,
      mt1.position AS start_pos,
      mt1.set,
      mt1.song_title || ' > ' || mt2.song_title as segue_text
    FROM matched_tracks mt1
    JOIN matched_tracks mt2 ON mt1.next_track_id = mt2.track_id
    WHERE mt1.segue = '>'
      AND mt1.show_id = mt2.show_id
      AND is_segue 
      AND array_length(search_songs, 1) = 2
      AND mt1.song_lower LIKE '%' || LOWER(search_songs[1]) || '%'
      AND mt2.song_lower LIKE '%' || LOWER(search_songs[2]) || '%'
  ),
  regular_matches AS (
    -- For non-segue searches, group by show
    SELECT 
      mt.show_id AS match_show_id,
      50 as proximity_score,
      STRING_AGG(
        mt.song_title || 
        CASE 
          WHEN mt.position = 1 THEN ' (Opener)'
          WHEN mt.next_track_id IS NULL THEN ' (Closer)'
          ELSE ''
        END,
        ', ' ORDER BY mt.position
      ) as match_details
    FROM matched_tracks mt
    WHERE NOT is_segue
    GROUP BY mt.show_id
  ),
  all_matches AS (
    -- Combine segue and regular matches
    SELECT * FROM (
      SELECT 
        match_show_id,
        100 as proximity_score,
        set || ': ' || segue_text as match_details
      FROM segue_matches
      
      UNION ALL
      
      SELECT * FROM regular_matches
    ) combined
  )
  SELECT 
    am.match_show_id,
    sh.slug::TEXT,
    sh.date::TEXT,
    v.name::TEXT,
    v.city::TEXT,
    v.state::TEXT,
    v.country::TEXT,
    am.proximity_score,
    am.match_details::TEXT
  FROM all_matches am
  JOIN shows sh ON am.match_show_id = sh.id
  LEFT JOIN venues v ON sh.venue_id = v.id
  ORDER BY am.proximity_score DESC, sh.date DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;