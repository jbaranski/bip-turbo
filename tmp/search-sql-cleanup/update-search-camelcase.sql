-- Update search function to return camelCase JSON
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
  WITH filtered_shows AS (
    -- BASE FILTER: Only shows at matching venues (if venue_ids provided)
    SELECT s.id, s.slug, s.date, s.venue_id
    FROM shows s
    WHERE venue_ids IS NULL OR s.venue_id = ANY(venue_ids)
  ),
  filtered_tracks AS (
    -- BASE FILTER: Only tracks with matching songs (if song_ids provided) at filtered shows
    SELECT 
      t.show_id,
      t.id as track_id,
      t.position,
      t.set,
      t.segue,
      t.next_track_id,
      t.note,
      s.title as song_title,
      s.id as song_id,
      LOWER(s.title) as song_lower,
      -- Context: previous and next songs
      LAG(s2.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as prev_song,
      LEAD(s3.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as next_song,
      LAG(t2.segue) OVER (PARTITION BY t.show_id ORDER BY t.position) as prev_segue
    FROM tracks t
    JOIN songs s ON t.song_id = s.id
    JOIN filtered_shows fs ON t.show_id = fs.id
    LEFT JOIN tracks t2 ON t2.next_track_id = t.id  -- Previous track
    LEFT JOIN songs s2 ON t2.song_id = s2.id        -- Previous song
    LEFT JOIN tracks t3 ON t.next_track_id = t3.id  -- Next track  
    LEFT JOIN songs s3 ON t3.song_id = s3.id        -- Next song
    WHERE song_ids IS NULL OR t.song_id = ANY(song_ids)
  ),
  matched_tracks AS (
    -- Find tracks that match search terms (after base filtering)
    SELECT 
      ft.*,
      -- Score based on text matching quality (not entity IDs - those are already filtered)
      CASE 
        WHEN song_ids IS NOT NULL THEN 100  -- Exact entity match (already filtered above)
        WHEN EXISTS (
          SELECT 1 FROM unnest(search_songs) AS ss
          WHERE ft.song_lower LIKE '%' || LOWER(ss) || '%'
        ) THEN 70  -- Text match within filtered results
        WHEN ft.song_lower LIKE '%' || LOWER(array_to_string(search_songs, ' ')) || '%' THEN 50
        ELSE 30  -- Fallback match
      END as song_match_score,
      -- Mark entity matches for frontend highlighting
      CASE WHEN song_ids IS NOT NULL THEN true ELSE false END as is_exact_match
    FROM filtered_tracks ft
    WHERE 
      -- If we have song_ids, we already filtered above, so include all
      song_ids IS NOT NULL
      OR
      -- If no song_ids, do text matching
      (song_ids IS NULL AND (
        EXISTS (
          SELECT 1 FROM unnest(search_songs) AS ss
          WHERE ft.song_lower LIKE '%' || LOWER(ss) || '%'
        )
        OR ft.song_lower LIKE '%' || LOWER(array_to_string(search_songs, ' ')) || '%'
      ))
  ),
  segue_matches AS (
    -- Find segue patterns in the matched tracks
    SELECT DISTINCT
      mt1.show_id AS match_show_id,
      json_build_object(
        'type', 'segue',
        'song1', mt1.song_title,
        'song2', mt2.song_title,
        'segueSymbol', mt1.segue,
        'set', mt1.set,
        'positions', array[mt1.position, mt2.position],
        'note1', mt1.note,
        'note2', mt2.note,
        'exactMatches', array[mt1.is_exact_match, mt2.is_exact_match]
      )::text as context_data,
      -- Higher scores for better matches
      CASE 
        WHEN mt1.is_exact_match AND mt2.is_exact_match THEN 150
        WHEN mt1.is_exact_match OR mt2.is_exact_match THEN 120
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
      -- Scoring: entity matches get base score, venue matches get bonus
      CASE 
        WHEN sm.match_show_id IS NOT NULL THEN sm.segue_score
        ELSE GREATEST(50, MAX(mt.song_match_score))
      END + 
      -- Venue bonus (only when not already filtered by venue_ids)
      CASE 
        WHEN venue_ids IS NOT NULL THEN 50  -- Bonus for being in target venues
        ELSE 0
      END as final_score,
      -- Context data for frontend (using camelCase)
      COALESCE(
        sm.context_data,
        json_build_object(
          'type', 'trackMatches',
          'tracks', json_agg(
            json_build_object(
              'song', mt.song_title,
              'position', mt.position,
              'set', mt.set,
              'note', mt.note,
              'prevSong', mt.prev_song,
              'nextSong', mt.next_song,
              'prevSegue', mt.prev_segue,
              'nextSegue', mt.segue,
              'isExactMatch', mt.is_exact_match,
              'isOpener', CASE WHEN mt.position = 1 THEN true ELSE false END,
              'isCloser', CASE WHEN mt.next_track_id IS NULL THEN true ELSE false END
            ) ORDER BY mt.position
          )
        )::text
      ) as match_details
    FROM matched_tracks mt
    LEFT JOIN segue_matches sm ON mt.show_id = sm.match_show_id
    WHERE is_segue = false OR sm.match_show_id IS NOT NULL
    GROUP BY sm.match_show_id, mt.show_id, sm.context_data, sm.segue_score
  )
  SELECT 
    sm.match_show_id,
    sh.slug::TEXT,
    sh.date::TEXT,
    v.name::TEXT,
    v.city::TEXT,
    v.state::TEXT,
    v.country::TEXT,
    sm.final_score::INTEGER,
    sm.match_details::TEXT
  FROM show_matches sm
  JOIN shows sh ON sm.match_show_id = sh.id
  LEFT JOIN venues v ON sh.venue_id = v.id
  ORDER BY sm.final_score DESC, sh.date DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;