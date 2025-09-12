-- Check how many shows and tracks have search data populated
SELECT 
  'Shows' as entity_type,
  COUNT(*) as total_count,
  COUNT(search_text) as with_search_text,
  COUNT(search_vector) as with_search_vector,
  COUNT(*) - COUNT(search_text) as missing_search_text,
  ROUND((COUNT(search_text)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as percent_complete
FROM shows
UNION ALL
SELECT 
  'Tracks' as entity_type,
  COUNT(*) as total_count,
  COUNT(search_text) as with_search_text,
  COUNT(search_vector) as with_search_vector,
  COUNT(*) - COUNT(search_text) as missing_search_text,
  ROUND((COUNT(search_text)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) as percent_complete
FROM tracks;

-- Sample of shows without search data
SELECT id, date, slug FROM shows 
WHERE search_text IS NULL 
LIMIT 5;

-- Sample of tracks without search data  
SELECT t.id, s.date as show_date, sg.title as song_title
FROM tracks t
JOIN shows s ON t.show_id = s.id
JOIN songs sg ON t.song_id = sg.id
WHERE t.search_text IS NULL
LIMIT 5;