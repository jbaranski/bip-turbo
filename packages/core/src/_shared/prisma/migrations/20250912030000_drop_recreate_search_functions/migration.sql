-- Force recreation of search functions to fix ambiguous column references
-- This is needed because CREATE OR REPLACE FUNCTION doesn't always update the function body properly

-- Drop existing functions that have ambiguous column references
DROP FUNCTION IF EXISTS build_show_search_text(uuid);
DROP FUNCTION IF EXISTS build_track_search_text(uuid);
DROP FUNCTION IF EXISTS search_shows_with_songs(text[], boolean);

-- Recreate build_show_search_text with proper column qualifiers
CREATE FUNCTION build_show_search_text(show_id UUID) 
RETURNS TEXT AS $$
DECLARE
  search_content TEXT;
  venue_info TEXT;
  setlist_info TEXT;
BEGIN
  -- Get venue information (name, city, state, country)
  SELECT 
    COALESCE(v.name, '') || ' ' || 
    COALESCE(v.city, '') || ' ' || 
    COALESCE(v.state, '') || ' ' ||
    COALESCE(v.country, '')
  INTO venue_info
  FROM shows s
  LEFT JOIN venues v ON s.venue_id = v.id
  WHERE s.id = build_show_search_text.show_id;
  
  -- Get complete setlist with songs, annotations, and segues
  SELECT string_agg(
    song.title || 
    COALESCE(' ' || t.note, '') ||
    CASE 
      WHEN t.segue = '>' THEN ' > ' || next_song.title
      ELSE ''
    END,
    ' ' ORDER BY t.position
  )
  INTO setlist_info
  FROM tracks t
  JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
  WHERE t.show_id = build_show_search_text.show_id;
  
  -- Combine all searchable content
  SELECT 
    s.date || ' ' ||
    COALESCE(venue_info, '') || ' ' ||
    COALESCE(setlist_info, '')
  INTO search_content
  FROM shows s
  WHERE s.id = build_show_search_text.show_id;
  
  RETURN search_content;
END;
$$ LANGUAGE plpgsql;

-- Recreate build_track_search_text with proper column qualifiers
CREATE FUNCTION build_track_search_text(track_id UUID)
RETURNS TEXT AS $$
DECLARE
  search_content TEXT;
BEGIN
  SELECT 
    song.title || ' ' ||
    COALESCE(t.note, '') || ' ' ||
    COALESCE(t.set, '') || ' ' ||
    -- Add position context
    CASE 
      WHEN t.position = 1 THEN 'opener '
      WHEN t.position = (SELECT MAX(position) FROM tracks tr WHERE tr.show_id = t.show_id AND tr.set = t.set) THEN 'closer '
      ELSE ''
    END ||
    -- Add segue information
    COALESCE('segue ' || t.segue, '') || ' ' ||
    -- Add neighboring songs for context
    COALESCE(prev_song.title, '') || ' ' ||
    COALESCE(next_song.title, '') || ' ' ||
    -- Include annotations
    COALESCE(ann.desc, '')
  INTO search_content
  FROM tracks t
  JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks prev_track ON t.previous_track_id = prev_track.id
  LEFT JOIN songs prev_song ON prev_track.song_id = prev_song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
  LEFT JOIN annotations ann ON ann.track_id = t.id
  WHERE t.id = build_track_search_text.track_id;
  
  RETURN search_content;
END;
$$ LANGUAGE plpgsql;

-- Recreate search_shows_with_songs with proper column qualifiers
CREATE FUNCTION search_shows_with_songs(
  search_songs TEXT[], 
  is_segue BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
  show_id UUID,
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
              SELECT 1 FROM matched_tracks mt1_inner
              JOIN matched_tracks mt2_inner ON mt1_inner.next_track_id = mt2_inner.track_id
              WHERE mt1_inner.show_id = mt.show_id
                AND mt1_inner.segue = '>'
                AND mt1_inner.search_position = 1
                AND mt2_inner.search_position = 2
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
    sm.show_id,
    s.date as show_date,
    v.name as venue_name,
    sm.proximity_score as match_score,
    sm.match_details
  FROM show_matches sm
  JOIN shows s ON sm.show_id = s.id
  LEFT JOIN venues v ON s.venue_id = v.id
  ORDER BY sm.proximity_score DESC, s.date DESC;
END;
$$ LANGUAGE plpgsql;