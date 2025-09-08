-- Test searching for songs
SELECT * FROM search_songs('Run Like Hell', 5);
SELECT * FROM search_songs('Crystal', 5);
SELECT * FROM search_songs('Helicopter', 5);
SELECT * FROM search_songs('Very Moon', 5);

-- Test searching for venues
SELECT * FROM search_venues('Crystal Bay', 5);
SELECT * FROM search_venues('Madison Square', 5);
SELECT * FROM search_venues('New York', 5);
SELECT * FROM search_venues('San Francisco', 5);

-- Check if search fields were populated
SELECT COUNT(*) as total_songs, 
       COUNT(search_text) as songs_with_search_text,
       COUNT(search_vector) as songs_with_search_vector
FROM songs;

SELECT COUNT(*) as total_venues, 
       COUNT(search_text) as venues_with_search_text,
       COUNT(search_vector) as venues_with_search_vector
FROM venues;