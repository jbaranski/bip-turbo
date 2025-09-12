-- Test the enhanced search function directly
SELECT 'Testing v3 with entity IDs' as test;

-- Test 1: Search for "Run Like Hell" - should find song ID and use it
-- First get the song ID
SELECT song_id FROM search_songs('Run Like Hell', 1);

-- Test the enhanced function with song ID
SELECT * FROM search_shows_with_songs_v3(
  ARRAY['Run Like Hell'], 
  false,
  ARRAY['36706496-2190-47fe-a002-ec0af441d70e']::UUID[],  -- Run Like Hell ID
  NULL::UUID[]
) LIMIT 3;

-- Test 2: Search for "Crystal Bay" - should find venue ID and use it  
-- First get the venue ID
SELECT venue_id FROM search_venues('Crystal Bay', 1);

-- Test the enhanced function with venue ID
SELECT * FROM search_shows_with_songs_v3(
  ARRAY['Crystal Bay'], 
  false,
  NULL::UUID[],
  ARRAY['e4fce011-a383-434a-a23b-cb5869a148fe']::UUID[]  -- Crystal Bay Club Casino ID
) LIMIT 3;

-- Test 3: Combined song + venue search
SELECT * FROM search_shows_with_songs_v3(
  ARRAY['Run Like Hell', 'Crystal Bay'], 
  false,
  ARRAY['36706496-2190-47fe-a002-ec0af441d70e']::UUID[],  -- Run Like Hell ID
  ARRAY['e4fce011-a383-434a-a23b-cb5869a148fe']::UUID[]   -- Crystal Bay Club Casino ID  
) LIMIT 3;