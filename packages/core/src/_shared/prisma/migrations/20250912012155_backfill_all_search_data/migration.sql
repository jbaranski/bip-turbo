-- =====================================================
-- Complete Search Data Backfill for Production Deploy
-- =====================================================
-- This script populates search_text and search_vector fields
-- for ALL entities that have search capabilities.
--
-- IMPORTANT: Run this AFTER migrations have completed
-- Tables affected: shows, tracks, songs, venues, segue_runs

-- First, check current state of all search fields
DO $$
DECLARE
  shows_total INTEGER;
  shows_with_search INTEGER;
  tracks_total INTEGER; 
  tracks_with_search INTEGER;
  songs_total INTEGER;
  songs_with_search INTEGER;
  venues_total INTEGER;
  venues_with_search INTEGER;
  segue_runs_total INTEGER;
  segue_runs_with_search INTEGER;
BEGIN
  -- Check shows
  SELECT COUNT(*), COUNT(search_text) 
  INTO shows_total, shows_with_search
  FROM shows;
  
  -- Check tracks  
  SELECT COUNT(*), COUNT(search_text)
  INTO tracks_total, tracks_with_search
  FROM tracks;
  
  -- Check songs
  SELECT COUNT(*), COUNT(search_text)
  INTO songs_total, songs_with_search  
  FROM songs;
  
  -- Check venues
  SELECT COUNT(*), COUNT(search_text)
  INTO venues_total, venues_with_search
  FROM venues;
  
  -- Check segue_runs
  SELECT COUNT(*), COUNT(search_text)
  INTO segue_runs_total, segue_runs_with_search
  FROM segue_runs;
  
  RAISE NOTICE '=== BEFORE BACKFILL ===';
  RAISE NOTICE 'Shows: % total, % with search data (% missing)', 
    shows_total, shows_with_search, shows_total - shows_with_search;
  RAISE NOTICE 'Tracks: % total, % with search data (% missing)', 
    tracks_total, tracks_with_search, tracks_total - tracks_with_search;
  RAISE NOTICE 'Songs: % total, % with search data (% missing)', 
    songs_total, songs_with_search, songs_total - songs_with_search;
  RAISE NOTICE 'Venues: % total, % with search data (% missing)', 
    venues_total, venues_with_search, venues_total - venues_with_search;
  RAISE NOTICE 'Segue Runs: % total, % with search data (% missing)', 
    segue_runs_total, segue_runs_with_search, segue_runs_total - segue_runs_with_search;
END $$;

-- =====================================================
-- 1. SONGS - Backfill search data 
-- =====================================================
RAISE NOTICE 'Backfilling songs search data...';

UPDATE songs SET 
  search_text = build_song_search_text(id),
  search_vector = to_tsvector('english', build_song_search_text(id))
WHERE search_text IS NULL OR search_vector IS NULL;

-- =====================================================
-- 2. VENUES - Backfill search data
-- =====================================================  
RAISE NOTICE 'Backfilling venues search data...';

UPDATE venues SET 
  search_text = build_venue_search_text(id),
  search_vector = to_tsvector('english', build_venue_search_text(id))
WHERE search_text IS NULL OR search_vector IS NULL;

-- =====================================================
-- 3. TRACKS & SHOWS - Use rebuild functions with existing logic
-- =====================================================
-- These use the comprehensive rebuild functions that handle:
-- 
-- SHOWS: venue info + complete setlist with segues and notes
-- TRACKS: song + notes + set + position context + segues + neighboring songs + annotations
--
-- The build_show_search_text() function includes:
-- - Venue: name, city, state, country
-- - Complete setlist with song titles, track notes, segue markers ('>'), next song titles
--
-- The build_track_search_text() function includes:
-- - Song title, track notes, set info
-- - Position context (opener/closer detection)  
-- - Segue information and neighboring song context
-- - Annotations descriptions

RAISE NOTICE 'Rebuilding all tracks and shows search data using existing build functions...';

-- Use the rebuild function which:
-- 1. Disables triggers for performance  
-- 2. Updates tracks first (since shows depend on track data)
-- 3. Updates shows second using comprehensive build_show_search_text()
-- 4. Re-enables triggers
SELECT rebuild_all_search_data();

-- =====================================================
-- 4. SEGUE RUNS - Manual backfill  
-- =====================================================
-- Segue runs don't have a dedicated build function yet
RAISE NOTICE 'Backfilling segue runs search data...';

UPDATE segue_runs SET 
  search_text = sequence,
  search_vector = to_tsvector('english', sequence)  
WHERE search_text IS NULL OR search_vector IS NULL;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================
DO $$
DECLARE
  shows_total INTEGER;
  shows_with_search INTEGER;
  tracks_total INTEGER;
  tracks_with_search INTEGER; 
  songs_total INTEGER;
  songs_with_search INTEGER;
  venues_total INTEGER;
  venues_with_search INTEGER;
  segue_runs_total INTEGER;
  segue_runs_with_search INTEGER;
BEGIN
  -- Check shows
  SELECT COUNT(*), COUNT(search_text) 
  INTO shows_total, shows_with_search
  FROM shows;
  
  -- Check tracks
  SELECT COUNT(*), COUNT(search_text)
  INTO tracks_total, tracks_with_search
  FROM tracks;
  
  -- Check songs  
  SELECT COUNT(*), COUNT(search_text)
  INTO songs_total, songs_with_search
  FROM songs;
  
  -- Check venues
  SELECT COUNT(*), COUNT(search_text)
  INTO venues_total, venues_with_search  
  FROM venues;
  
  -- Check segue_runs
  SELECT COUNT(*), COUNT(search_text)
  INTO segue_runs_total, segue_runs_with_search
  FROM segue_runs;
  
  RAISE NOTICE '=== AFTER BACKFILL ===';
  RAISE NOTICE 'Shows: % total, % with search data (% complete)', 
    shows_total, shows_with_search, 
    CASE WHEN shows_total > 0 THEN ROUND((shows_with_search::NUMERIC / shows_total::NUMERIC) * 100, 2) ELSE 0 END || '%';
  RAISE NOTICE 'Tracks: % total, % with search data (% complete)', 
    tracks_total, tracks_with_search,
    CASE WHEN tracks_total > 0 THEN ROUND((tracks_with_search::NUMERIC / tracks_total::NUMERIC) * 100, 2) ELSE 0 END || '%';
  RAISE NOTICE 'Songs: % total, % with search data (% complete)', 
    songs_total, songs_with_search,
    CASE WHEN songs_total > 0 THEN ROUND((songs_with_search::NUMERIC / songs_total::NUMERIC) * 100, 2) ELSE 0 END || '%';
  RAISE NOTICE 'Venues: % total, % with search data (% complete)', 
    venues_total, venues_with_search,
    CASE WHEN venues_total > 0 THEN ROUND((venues_with_search::NUMERIC / venues_total::NUMERIC) * 100, 2) ELSE 0 END || '%';
  RAISE NOTICE 'Segue Runs: % total, % with search data (% complete)', 
    segue_runs_total, segue_runs_with_search,
    CASE WHEN segue_runs_total > 0 THEN ROUND((segue_runs_with_search::NUMERIC / segue_runs_total::NUMERIC) * 100, 2) ELSE 0 END || '%';
    
  -- Alert if any tables still have missing search data
  IF shows_with_search < shows_total THEN
    RAISE WARNING 'Shows still have % missing search data!', shows_total - shows_with_search;
  END IF;
  
  IF tracks_with_search < tracks_total THEN  
    RAISE WARNING 'Tracks still have % missing search data!', tracks_total - tracks_with_search;
  END IF;
  
  IF songs_with_search < songs_total THEN
    RAISE WARNING 'Songs still have % missing search data!', songs_total - songs_with_search; 
  END IF;
  
  IF venues_with_search < venues_total THEN
    RAISE WARNING 'Venues still have % missing search data!', venues_total - venues_with_search;
  END IF;
  
  IF segue_runs_with_search < segue_runs_total THEN
    RAISE WARNING 'Segue runs still have % missing search data!', segue_runs_total - segue_runs_with_search;
  END IF;
  
  RAISE NOTICE '=== BACKFILL COMPLETE ===';
END $$;