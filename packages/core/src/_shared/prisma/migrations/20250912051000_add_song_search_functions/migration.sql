-- Function to build song search text
CREATE OR REPLACE FUNCTION build_song_search_text(p_song_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT title
  INTO result
  FROM songs s
  WHERE s.id = p_song_id;
  
  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Trigger function for songs
CREATE OR REPLACE FUNCTION update_song_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_song_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for songs
DROP TRIGGER IF EXISTS trigger_update_song_search_fields ON songs;
CREATE TRIGGER trigger_update_song_search_fields
BEFORE INSERT OR UPDATE ON songs
FOR EACH ROW
EXECUTE FUNCTION update_song_search_fields();