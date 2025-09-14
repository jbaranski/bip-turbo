-- Backfill search data for all tables

-- Update songs
UPDATE songs SET 
  search_text = build_song_search_text(id),
  search_vector = to_tsvector('english', build_song_search_text(id));

-- Update venues  
UPDATE venues SET 
  search_text = build_venue_search_text(id),
  search_vector = to_tsvector('english', build_venue_search_text(id));

-- Update tracks
UPDATE tracks SET 
  search_text = build_track_search_text(id),
  search_vector = to_tsvector('english', build_track_search_text(id));

-- Update shows (do this last since it depends on tracks)
UPDATE shows SET 
  search_text = build_show_search_text(id),
  search_vector = to_tsvector('english', build_show_search_text(id));