-- Ellipsis escape issue
SELECT * FROM songs WHERE lyrics ~ 'â€¦';

UPDATE songs
SET lyrics = REPLACE(lyrics, 'â€¦', '...')
WHERE lyrics ~ 'â€¦';

SELECT * FROM songs WHERE lyrics ~ 'â€¦';

-- Apostrophe escape issue cleanup
SELECT * FROM songs WHERE lyrics ~ 'â€™';

UPDATE songs
SET lyrics = REPLACE(lyrics, 'â€™', '''')
WHERE lyrics ~ 'â€™';

SELECT * FROM songs WHERE lyrics ~ 'â€™';
