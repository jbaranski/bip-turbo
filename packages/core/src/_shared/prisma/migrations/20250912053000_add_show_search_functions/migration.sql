-- Function to build show search text with date variations
CREATE OR REPLACE FUNCTION build_show_search_text(input_show_id UUID)
RETURNS TEXT AS $$
DECLARE
  search_content TEXT;
  venue_info TEXT;
  setlist_info TEXT;
  show_date TEXT;
  date_variations TEXT;
BEGIN
  -- Get show date and venue information
  SELECT 
    s.date,
    COALESCE(v.name, '') || ' ' || 
    COALESCE(v.city, '') || ' ' || 
    COALESCE(v.state, '') || ' ' ||
    COALESCE(v.country, '')
  INTO show_date, venue_info
  FROM shows s
  LEFT JOIN venues v ON s.venue_id = v.id
  WHERE s.id = input_show_id;
  
  -- Create date variations (YYYY-MM-DD, MM/DD/YY, etc)
  SELECT 
    show_date || ' ' ||
    CASE 
      WHEN show_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
        TO_CHAR(show_date::DATE, 'MM/DD/YY') || ' ' ||
        TO_CHAR(show_date::DATE, 'MM/DD/YYYY') || ' ' ||
        TO_CHAR(show_date::DATE, 'Month DD, YYYY')
      ELSE ''
    END
  INTO date_variations;
  
  -- Get complete setlist with songs and segues
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
  WHERE t.show_id = input_show_id;
  
  -- Combine all searchable content
  RETURN TRIM(COALESCE(date_variations, '') || ' ' ||
              COALESCE(venue_info, '') || ' ' ||
              COALESCE(setlist_info, ''));
END;
$$ LANGUAGE plpgsql;

-- Trigger function for shows
CREATE OR REPLACE FUNCTION update_show_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_show_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shows
DROP TRIGGER IF EXISTS trigger_update_show_search_fields ON shows;
CREATE TRIGGER trigger_update_show_search_fields
BEFORE INSERT OR UPDATE ON shows
FOR EACH ROW
EXECUTE FUNCTION update_show_search_fields();