-- Update search_shows_with_songs_v3 to add fallback logic and better context
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
      t.note,
      LOWER(s.title) as song_lower,
      s.id as song_id,
      -- Get previous and next song for context
      LAG(s2.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as prev_song,
      LEAD(s3.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as next_song,
      LAG(t2.segue) OVER (PARTITION BY t.show_id ORDER BY t.position) as prev_segue
    FROM tracks t
    JOIN songs s ON t.song_id = s.id
    LEFT JOIN tracks t2 ON t2.next_track_id = t.id  -- Previous track
    LEFT JOIN songs s2 ON t2.song_id = s2.id        -- Previous song
    LEFT JOIN tracks t3 ON t.next_track_id = t3.id  -- Next track  
    LEFT JOIN songs s3 ON t3.song_id = s3.id        -- Next song
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
      tp.note,
      tp.song_lower,
      tp.song_id,
      tp.prev_song,
      tp.next_song,
      tp.prev_segue,
      -- Score higher for exact song ID matches, lower threshold for fallback
      CASE 
        WHEN song_ids IS NOT NULL AND tp.song_id = ANY(song_ids) THEN 100
        WHEN EXISTS (
          SELECT 1 FROM unnest(search_songs) AS ss
          WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
        ) THEN 60
        -- FALLBACK: Broader matching when entity resolution fails
        WHEN song_ids IS NULL AND tp.song_lower LIKE '%' || LOWER(array_to_string(search_songs, ' ')) || '%' THEN 30
        ELSE 0
      END as song_match_score,
      -- Mark if this is an exact song ID match
      CASE 
        WHEN song_ids IS NOT NULL AND tp.song_id = ANY(song_ids) THEN true
        ELSE false
      END as is_exact_song_match
    FROM track_positions tp
    WHERE 
      -- Match exact song IDs if provided
      (song_ids IS NOT NULL AND tp.song_id = ANY(song_ids))
      OR
      -- Text matching on individual search terms
      EXISTS (
        SELECT 1 FROM unnest(search_songs) AS ss
        WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
      )
      -- FALLBACK: Broader text search when no entity matches
      OR (
        song_ids IS NULL AND 
        tp.song_lower LIKE '%' || LOWER(array_to_string(search_songs, ' ')) || '%'
      )
  ),
  venue_matched_shows AS (
    -- Find shows at specific venues with fallback
    SELECT DISTINCT
      s.id as show_id,
      CASE 
        WHEN venue_ids IS NOT NULL AND s.venue_id = ANY(venue_ids) THEN 100
        WHEN venue_ids IS NULL AND EXISTS (
          SELECT 1 FROM unnest(search_songs) AS ss
          WHERE LOWER(v.name || ' ' || COALESCE(v.city, '') || ' ' || COALESCE(v.state, '')) 
                LIKE '%' || LOWER(ss) || '%'
        ) THEN 50
        ELSE 0
      END as venue_match_score
    FROM shows s
    LEFT JOIN venues v ON s.venue_id = v.id
    WHERE 
      -- Match exact venue IDs if provided
      (venue_ids IS NOT NULL AND s.venue_id = ANY(venue_ids))
      OR
      -- Text matching on venue info for fallback
      (venue_ids IS NULL AND EXISTS (
        SELECT 1 FROM unnest(search_songs) AS ss
        WHERE LOWER(v.name || ' ' || COALESCE(v.city, '') || ' ' || COALESCE(v.state, '')) 
              LIKE '%' || LOWER(ss) || '%'
      ))
      OR
      -- Allow all shows for broad fallback
      (venue_ids IS NULL)
  ),
  segue_matches AS (
    -- Find segue occurrences
    SELECT DISTINCT
      mt1.show_id AS match_show_id,
      mt1.position AS start_pos,
      mt2.position AS end_pos,
      mt1.set,
      -- Return raw segue context for frontend formatting
      json_build_object(
        'type', 'segue',
        'song1', mt1.song_title,
        'song2', mt2.song_title,
        'segue_symbol', mt1.segue,
        'set', mt1.set,
        'positions', array[mt1.position, mt2.position],
        'note1', mt1.note,
        'note2', mt2.note,
        'exact_matches', array[mt1.is_exact_song_match, mt2.is_exact_song_match]
      )::text as context_data,
      -- Scoring
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
  ),
  show_matches AS (
    SELECT 
      COALESCE(sm.match_show_id, mt.show_id) AS match_show_id,
      CASE 
        WHEN sm.match_show_id IS NOT NULL THEN 
          -- Segue match score + venue bonus
          sm.segue_score + COALESCE(vms.venue_match_score / 2, 0)
        ELSE 
          -- Regular match score + venue bonus (lowered minimum)
          GREATEST(20, MAX(mt.song_match_score)) + COALESCE(vms.venue_match_score / 2, 0)
      END as proximity_score,
      -- Return structured context data for frontend
      COALESCE(
        sm.context_data,
        -- For regular matches, return track context as JSON
        json_build_object(
          'type', 'track_matches',
          'tracks', json_agg(
            json_build_object(
              'song', mt.song_title,
              'position', mt.position,
              'set', mt.set,
              'note', mt.note,
              'prev_song', mt.prev_song,
              'next_song', mt.next_song,
              'prev_segue', mt.prev_segue,
              'next_segue', mt.segue,
              'is_exact_match', mt.is_exact_song_match,
              'is_opener', CASE WHEN mt.position = 1 THEN true ELSE false END,
              'is_closer', CASE WHEN mt.next_track_id IS NULL THEN true ELSE false END
            ) ORDER BY mt.position
          )
        )::text
      ) as match_details
    FROM matched_tracks mt
    LEFT JOIN segue_matches sm ON mt.show_id = sm.match_show_id
    LEFT JOIN venue_matched_shows vms ON 
      COALESCE(sm.match_show_id, mt.show_id) = vms.show_id
    WHERE 
      (is_segue = false OR sm.match_show_id IS NOT NULL)
      -- Lower threshold to prevent zero results
      AND (mt.song_match_score >= 20 OR vms.venue_match_score > 0)
    GROUP BY sm.match_show_id, mt.show_id, sm.context_data, sm.segue_score, vms.venue_match_score
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