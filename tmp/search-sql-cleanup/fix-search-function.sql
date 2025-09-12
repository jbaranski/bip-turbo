-- Drop the old v2 function if it exists
DROP FUNCTION IF EXISTS search_shows_with_songs_v2(TEXT[], BOOLEAN);

-- Create the updated function with show_slug in the return type
CREATE OR REPLACE FUNCTION search_shows_with_songs_v2(
  search_songs TEXT[], 
  is_segue BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
  show_id UUID,
  show_slug TEXT,
  show_date TEXT,
  venue_name TEXT,
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
      tp.*,
      array_position(search_songs, 
        (SELECT ss FROM unnest(search_songs) ss 
         WHERE LOWER(ss) = tp.song_lower 
            OR tp.song_lower LIKE '%' || LOWER(ss) || '%'
         LIMIT 1)
      ) as search_position
    FROM track_positions tp
    WHERE EXISTS (
      SELECT 1 FROM unnest(search_songs) AS ss
      WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
    )
  ),
  show_matches AS (
    SELECT 
      mt.show_id,
      -- Calculate proximity score based on track positions
      CASE 
        WHEN is_segue AND array_length(search_songs, 1) = 2 THEN
          -- For segue searches, check if songs are adjacent with segue marker
          CASE
            WHEN EXISTS (
              SELECT 1 FROM matched_tracks mt1
              JOIN matched_tracks mt2 ON mt1.next_track_id = mt2.track_id
              WHERE mt1.show_id = mt.show_id
                AND mt1.segue = '>'
                AND mt1.search_position = 1
                AND mt2.search_position = 2
            ) THEN 100  -- Perfect segue match
            WHEN MIN(ABS(mt2.position - mt1.position)) = 1 THEN 80  -- Adjacent but no segue
            WHEN MIN(ABS(mt2.position - mt1.position)) <= 3 THEN 60  -- Very close
            WHEN MIN(ABS(mt2.position - mt1.position)) <= 5 THEN 40  -- Same set usually
            ELSE 20  -- In same show but far apart
          END
        ELSE
          -- For multi-song (non-segue) search
          CASE
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1) 
                 AND (MAX(mt.position) - MIN(mt.position)) = array_length(search_songs, 1) - 1 THEN 90  -- All consecutive
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1)
                 AND (MAX(mt.position) - MIN(mt.position)) <= array_length(search_songs, 1) + 2 THEN 70  -- Close together
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1)
                 AND (MAX(mt.position) - MIN(mt.position)) <= array_length(search_songs, 1) * 2 THEN 50  -- Somewhat close
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1) THEN 30  -- All in same show
            ELSE 10  -- Partial match
          END
      END as proximity_score,
      -- Build match details showing positions and sets
      STRING_AGG(
        mt.song_title || ' (pos ' || mt.position || ', ' || mt.set || ')',
        ' → ' ORDER BY mt.position
      ) as match_details
    FROM matched_tracks mt
    LEFT JOIN matched_tracks mt1 ON mt.show_id = mt1.show_id AND mt1.search_position = 1
    LEFT JOIN matched_tracks mt2 ON mt.show_id = mt2.show_id AND mt2.search_position = 2
    GROUP BY mt.show_id
    HAVING COUNT(DISTINCT mt.song_lower) >= 
      CASE WHEN is_segue THEN array_length(search_songs, 1) ELSE 1 END
  )
  SELECT 
    show_matches.show_id,
    sh.slug::TEXT as show_slug,
    sh.date::TEXT as show_date,
    v.name::TEXT as venue_name,
    show_matches.proximity_score as match_score,
    show_matches.match_details::TEXT
  FROM show_matches
  JOIN shows sh ON show_matches.show_id = sh.id
  LEFT JOIN venues v ON sh.venue_id = v.id
  ORDER BY show_matches.proximity_score DESC, sh.date DESC;
END;
$$ LANGUAGE plpgsql;