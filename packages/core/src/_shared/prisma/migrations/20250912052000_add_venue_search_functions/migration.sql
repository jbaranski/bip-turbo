-- Function to build venue search text
CREATE OR REPLACE FUNCTION build_venue_search_text(p_venue_id UUID)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT 
    COALESCE(v.name, '') || ' ' ||
    COALESCE(v.city, '') || ' ' ||
    CASE 
      WHEN v.state IS NOT NULL THEN v.state
      WHEN UPPER(v.country) != 'USA' THEN COALESCE(v.country, '')
      ELSE ''
    END
  INTO result
  FROM venues v
  WHERE v.id = p_venue_id;
  
  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for venues
CREATE OR REPLACE FUNCTION update_venue_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_venue_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.search_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for venues
DROP TRIGGER IF EXISTS trigger_update_venue_search_fields ON venues;
CREATE TRIGGER trigger_update_venue_search_fields
BEFORE INSERT OR UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION update_venue_search_fields();