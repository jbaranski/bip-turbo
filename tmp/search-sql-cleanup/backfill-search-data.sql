-- First check the current state
DO $$
DECLARE
  shows_total INTEGER;
  shows_with_search INTEGER;
  tracks_total INTEGER;
  tracks_with_search INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(search_text) 
  INTO shows_total, shows_with_search
  FROM shows;
  
  SELECT COUNT(*), COUNT(search_text)
  INTO tracks_total, tracks_with_search
  FROM tracks;
  
  RAISE NOTICE 'Shows: % total, % with search data (% missing)', 
    shows_total, shows_with_search, shows_total - shows_with_search;
  RAISE NOTICE 'Tracks: % total, % with search data (% missing)', 
    tracks_total, tracks_with_search, tracks_total - tracks_with_search;
END $$;

-- Rebuild all search data using the functions we already created
SELECT rebuild_all_search_data();

-- Verify the results
DO $$
DECLARE
  shows_total INTEGER;
  shows_with_search INTEGER;
  tracks_total INTEGER;
  tracks_with_search INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(search_text) 
  INTO shows_total, shows_with_search
  FROM shows;
  
  SELECT COUNT(*), COUNT(search_text)
  INTO tracks_total, tracks_with_search
  FROM tracks;
  
  RAISE NOTICE 'After rebuild:';
  RAISE NOTICE 'Shows: % total, % with search data (% complete)', 
    shows_total, shows_with_search, ROUND((shows_with_search::NUMERIC / shows_total::NUMERIC) * 100, 2) || '%';
  RAISE NOTICE 'Tracks: % total, % with search data (% complete)', 
    tracks_total, tracks_with_search, ROUND((tracks_with_search::NUMERIC / tracks_total::NUMERIC) * 100, 2) || '%';
END $$;