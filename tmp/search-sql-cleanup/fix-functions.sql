-- Fix the build_show_search_text function
CREATE OR REPLACE FUNCTION build_show_search_text(p_show_id UUID)
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
  WHERE s.id = p_show_id;
  
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
  WHERE t.show_id = p_show_id;
  
  -- Combine all searchable content
  SELECT 
    s.date || ' ' ||
    COALESCE(venue_info, '') || ' ' ||
    COALESCE(setlist_info, '')
  INTO search_content
  FROM shows s
  WHERE s.id = p_show_id;
  
  RETURN search_content;
END;
$$ LANGUAGE plpgsql;

-- Now run the rebuild
SELECT rebuild_search_for_date_range('2024-01-01', '2024-01-31');