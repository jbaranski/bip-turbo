-- Debug entity resolution for "new york basis for a day"
SELECT 'SONG RESULTS:' as type, song_id, song_title, song_slug, match_score 
FROM search_songs('new york basis for a day', 10)
WHERE match_score >= 50
ORDER BY match_score DESC;

SELECT 'VENUE RESULTS:' as type, venue_id::text as id, venue_name as name, venue_slug, match_score 
FROM search_venues('new york basis for a day', 10)  
WHERE match_score >= 50
ORDER BY match_score DESC;