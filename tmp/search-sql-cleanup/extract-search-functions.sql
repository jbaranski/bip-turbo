-- Get the SQL definition of search_songs function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'search_songs';

-- Get the SQL definition of search_venues function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'search_venues';

-- Get the SQL definition of search_shows_with_songs_v3 function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'search_shows_with_songs_v3';

-- Get the SQL definition of search_date_match function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'search_date_match';