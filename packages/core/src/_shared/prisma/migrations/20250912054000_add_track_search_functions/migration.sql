-- Drop existing broken track functions and triggers first
DROP TRIGGER IF EXISTS track_search_fields_trigger ON tracks;
DROP TRIGGER IF EXISTS annotation_change_update_track_search ON annotations;
DROP FUNCTION IF EXISTS build_track_search_text(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_track_search_fields() CASCADE;
DROP FUNCTION IF EXISTS update_track_search_on_annotation_change() CASCADE;

-- Function to build track search text with full context
CREATE OR REPLACE FUNCTION build_track_search_text(input_track_id UUID)
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
      WHEN t.position = (SELECT MAX(tr.position) FROM tracks tr WHERE tr.show_id = t.show_id AND tr.set = t.set) THEN 'closer '
      ELSE ''
    END ||
    -- Add segue information
    COALESCE('segue ' || t.segue, '') || ' ' ||
    -- Add neighboring songs for context
    COALESCE(prev_song.title, '') || ' ' ||
    COALESCE(next_song.title, '') || ' ' ||
    -- Include annotations
    COALESCE(string_agg(ann.desc, ' '), '')
  INTO search_content
  FROM tracks t
  JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks prev_track ON t.previous_track_id = prev_track.id
  LEFT JOIN songs prev_song ON prev_track.song_id = prev_song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
  LEFT JOIN annotations ann ON ann.track_id = t.id
  WHERE t.id = input_track_id
  GROUP BY song.title, t.note, t.set, t.position, t.show_id, t.segue, prev_song.title, next_song.title;
  
  RETURN TRIM(search_content);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for tracks
CREATE OR REPLACE FUNCTION update_track_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_track_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracks
DROP TRIGGER IF EXISTS trigger_update_track_search_fields ON tracks;
CREATE TRIGGER trigger_update_track_search_fields
BEFORE INSERT OR UPDATE ON tracks
FOR EACH ROW
EXECUTE FUNCTION update_track_search_fields();