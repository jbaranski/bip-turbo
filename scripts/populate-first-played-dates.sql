-- Populate date_first_played for songs based on earliest show date from tracks
UPDATE songs 
SET date_first_played = subquery.first_played_date
FROM (
  SELECT 
    t.song_id,
    MIN(s.date::date) as first_played_date
  FROM tracks t
  JOIN shows s ON t.show_id = s.id
  WHERE s.date IS NOT NULL
  GROUP BY t.song_id
) AS subquery
WHERE songs.id = subquery.song_id
  AND songs.date_first_played IS NULL;

-- Show how many records were updated
SELECT 
  COUNT(*) as total_songs,
  COUNT(date_first_played) as songs_with_first_played_date
FROM songs;