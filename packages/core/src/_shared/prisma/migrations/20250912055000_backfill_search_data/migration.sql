-- NOTE: Backfill removed from migration due to performance/timeout issues
-- Run manually after deployment:
--
-- UPDATE songs SET search_text = build_song_search_text(id), search_vector = to_tsvector('english', build_song_search_text(id));
-- UPDATE venues SET search_text = build_venue_search_text(id), search_vector = to_tsvector('english', build_venue_search_text(id));
-- UPDATE tracks SET search_text = build_track_search_text(id), search_vector = to_tsvector('english', build_track_search_text(id));
-- UPDATE shows SET search_text = build_show_search_text(id), search_vector = to_tsvector('english', build_show_search_text(id));

-- Migration just ensures functions exist, triggers will populate data as records are updated
SELECT 'Search functions created successfully' as status;