# PostgreSQL Text Search Migration

## Overview

This document outlines the complete migration from OpenAI embeddings/vector search to PostgreSQL's native text search capabilities using `pg_trgm` (trigram similarity) and full text search extensions.

## Benefits

- **No external API dependencies** - Removes OpenAI embedding costs and latency
- **Simpler architecture** - No vector storage, embedding generation, or complex scoring algorithms
- **Better control** - Direct SQL queries with predictable, tunable scoring
- **Faster searches** - No embedding generation step, direct database queries
- **Easier debugging** - Standard SQL instead of opaque vector similarity calculations

## Search Requirements

### Shows Search
- **Date** - Multiple formats (12/30/99, Dec 30 1999, 1999-12-30, etc.)
- **Venue** - Name, city, state, country
- **Setlist** - All songs played, including annotations
- **Segues** - "Above the Waves > Nughuffer" finds shows with that transition

### Tracks Search  
- **Song title**
- **Annotations** - "inverted", "ending only", etc.
- **Segue information** - What it segues to/from
- **Set information** - "Set 1", "Set 2", "Encore"
- **Position** - Opener, closer
- **Context** - Previous/next songs

## Database Migration

### 1. Enable PostgreSQL Extensions

```sql
-- Enable trigram matching for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable unaccent for better text matching
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 2. Add Search Columns

```sql
-- Add search columns to shows table
ALTER TABLE shows ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search columns to tracks table  
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS search_text TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS search_vector tsvector;
```

### 3. Search Text Generation Functions

```sql
-- Function to build comprehensive show search text
CREATE OR REPLACE FUNCTION build_show_search_text(show_id UUID) 
RETURNS TEXT AS $$
DECLARE
  search_content TEXT;
  venue_info TEXT;
  setlist_info TEXT;
BEGIN
  -- Get venue information (name, city, state, country)
  SELECT 
    COALESCE(v.name, '') || ' ' || 
    COALESCE(v.city, '') || ' ' || 
    COALESCE(v.state, '') || ' ' ||
    COALESCE(v.country, '')
  INTO venue_info
  FROM shows s
  LEFT JOIN venues v ON s.venue_id = v.id
  WHERE s.id = show_id;
  
  -- Get complete setlist with songs, annotations, and segues
  SELECT string_agg(
    song.title || 
    COALESCE(' ' || t.note, '') ||
    CASE 
      WHEN t.segue = '>' THEN ' > ' || next_song.title
      ELSE ''
    END,
    ' ' ORDER BY t.position
  )
  INTO setlist_info
  FROM tracks t
  JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
  WHERE t.show_id = show_id;
  
  -- Combine all searchable content
  SELECT 
    s.date || ' ' ||
    COALESCE(venue_info, '') || ' ' ||
    COALESCE(setlist_info, '')
  INTO search_content
  FROM shows s
  WHERE s.id = show_id;
  
  RETURN search_content;
END;
$$ LANGUAGE plpgsql;

-- Function to build comprehensive track search text
CREATE OR REPLACE FUNCTION build_track_search_text(track_id UUID)
RETURNS TEXT AS $$
DECLARE
  search_content TEXT;
BEGIN
  SELECT 
    song.title || ' ' ||
    COALESCE(t.note, '') || ' ' ||
    COALESCE(t.set, '') || ' ' ||
    -- Add position context
    CASE 
      WHEN t.position = 1 THEN 'opener '
      WHEN t.position = (SELECT MAX(position) FROM tracks WHERE show_id = t.show_id AND set = t.set) THEN 'closer '
      ELSE ''
    END ||
    -- Add segue information
    COALESCE('segue ' || t.segue, '') || ' ' ||
    -- Add neighboring songs for context
    COALESCE(prev_song.title, '') || ' ' ||
    COALESCE(next_song.title, '') || ' ' ||
    -- Include annotations
    COALESCE(ann.desc, '')
  INTO search_content
  FROM tracks t
  JOIN songs song ON t.song_id = song.id
  LEFT JOIN tracks prev_track ON t.previous_track_id = prev_track.id
  LEFT JOIN songs prev_song ON prev_track.song_id = prev_song.id
  LEFT JOIN tracks next_track ON t.next_track_id = next_track.id
  LEFT JOIN songs next_song ON next_track.song_id = next_song.id
  LEFT JOIN annotations ann ON ann.track_id = t.id
  WHERE t.id = track_id;
  
  RETURN search_content;
END;
$$ LANGUAGE plpgsql;
```

### 4. Date Search Support

```sql
-- Function to handle multiple date formats in search
CREATE OR REPLACE FUNCTION search_date_match(show_date TEXT, query TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized_query TEXT;
  query_date DATE;
BEGIN
  normalized_query := LOWER(TRIM(query));
  
  -- Direct date match (YYYY-MM-DD format)
  IF show_date = normalized_query THEN
    RETURN TRUE;
  END IF;
  
  -- Try to parse various date formats
  BEGIN
    -- Handle formats like: 12/30/99, 12-30-99, 12.30.99
    IF normalized_query ~ '^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2}$' THEN
      -- Add century for 2-digit years (assume 20xx for 00-30, 19xx for 31-99)
      normalized_query := REGEXP_REPLACE(normalized_query, '(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2})$', 
        CASE 
          WHEN SUBSTRING(normalized_query FROM '\d{2}$')::INT <= 30 THEN '20\3-\1-\2'
          ELSE '19\3-\1-\2'
        END);
      query_date := normalized_query::DATE;
      
    -- Handle formats like: 12/30/1999, 12-30-1999
    ELSIF normalized_query ~ '^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4}$' THEN
      normalized_query := REGEXP_REPLACE(normalized_query, '(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})$', '\3-\1-\2');
      query_date := normalized_query::DATE;
      
    -- Handle formats like: "dec 30 1999", "december 30, 1999"
    ELSIF normalized_query ~ '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)' THEN
      query_date := normalized_query::DATE;
      
    -- Handle formats like: "30 dec 1999"
    ELSIF normalized_query ~ '^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)' THEN
      query_date := normalized_query::DATE;
      
    ELSE
      -- Try PostgreSQL's date parser as last resort
      query_date := normalized_query::DATE;
    END IF;
    
    -- Compare parsed date with show date
    RETURN show_date::DATE = query_date;
    
  EXCEPTION WHEN OTHERS THEN
    -- If date parsing fails, try partial matching
    -- Handle partial dates like "december 1999" or "12/99"
    IF normalized_query ~ '^\d{1,2}[/\-]\d{2,4}$' THEN
      -- Month/Year search
      RETURN show_date LIKE '%' || SUBSTR(normalized_query, 1, 2) || '%';
    ELSIF normalized_query ~ '^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*\d{4}$' THEN
      -- "December 1999" style - check if show is in that month
      RETURN show_date::DATE >= (normalized_query || ' 01')::DATE 
         AND show_date::DATE <= ((normalized_query || ' 01')::DATE + INTERVAL '1 month - 1 day');
    ELSE
      -- Fallback to pattern matching
      RETURN show_date ILIKE '%' || normalized_query || '%';
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;
```

### 5. Proximity-Based Segue Search

```sql
-- Function to search shows with multiple songs, considering proximity
CREATE OR REPLACE FUNCTION search_shows_with_songs(
  search_songs TEXT[], 
  is_segue BOOLEAN DEFAULT FALSE
) 
RETURNS TABLE(
  show_id UUID,
  show_date TEXT,
  venue_name TEXT,
  match_score INTEGER,
  match_details TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH track_positions AS (
    -- Get all tracks with their positions and song titles
    SELECT 
      t.show_id,
      t.id as track_id,
      t.position,
      t.set,
      s.title as song_title,
      t.segue,
      t.next_track_id,
      LOWER(s.title) as song_lower
    FROM tracks t
    JOIN songs s ON t.song_id = s.id
  ),
  matched_tracks AS (
    -- Find tracks matching our search songs
    SELECT 
      tp.*,
      array_position(search_songs, 
        (SELECT ss FROM unnest(search_songs) ss 
         WHERE LOWER(ss) = tp.song_lower 
            OR tp.song_lower LIKE '%' || LOWER(ss) || '%'
         LIMIT 1)
      ) as search_position
    FROM track_positions tp
    WHERE EXISTS (
      SELECT 1 FROM unnest(search_songs) AS ss
      WHERE tp.song_lower LIKE '%' || LOWER(ss) || '%'
    )
  ),
  show_matches AS (
    SELECT 
      mt.show_id,
      -- Calculate proximity score based on track positions
      CASE 
        WHEN is_segue AND array_length(search_songs, 1) = 2 THEN
          -- For segue searches, check if songs are adjacent with segue marker
          CASE
            WHEN EXISTS (
              SELECT 1 FROM matched_tracks mt1
              JOIN matched_tracks mt2 ON mt1.next_track_id = mt2.track_id
              WHERE mt1.show_id = mt.show_id
                AND mt1.segue = '>'
                AND mt1.search_position = 1
                AND mt2.search_position = 2
            ) THEN 100  -- Perfect segue match
            WHEN MIN(ABS(mt2.position - mt1.position)) = 1 THEN 80  -- Adjacent but no segue
            WHEN MIN(ABS(mt2.position - mt1.position)) <= 3 THEN 60  -- Very close
            WHEN MIN(ABS(mt2.position - mt1.position)) <= 5 THEN 40  -- Same set usually
            ELSE 20  -- In same show but far apart
          END
        ELSE
          -- For multi-song (non-segue) search
          CASE
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1) 
                 AND (MAX(mt.position) - MIN(mt.position)) = array_length(search_songs, 1) - 1 THEN 90  -- All consecutive
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1)
                 AND (MAX(mt.position) - MIN(mt.position)) <= array_length(search_songs, 1) + 2 THEN 70  -- Close together
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1)
                 AND (MAX(mt.position) - MIN(mt.position)) <= array_length(search_songs, 1) * 2 THEN 50  -- Somewhat close
            WHEN COUNT(DISTINCT mt.song_lower) = array_length(search_songs, 1) THEN 30  -- All in same show
            ELSE 10  -- Partial match
          END
      END as proximity_score,
      -- Build match details showing positions and sets
      STRING_AGG(
        mt.song_title || ' (pos ' || mt.position || ', ' || mt.set || ')',
        ' → ' ORDER BY mt.position
      ) as match_details
    FROM matched_tracks mt
    LEFT JOIN matched_tracks mt1 ON mt.show_id = mt1.show_id AND mt1.search_position = 1
    LEFT JOIN matched_tracks mt2 ON mt.show_id = mt2.show_id AND mt2.search_position = 2
    GROUP BY mt.show_id
    HAVING COUNT(DISTINCT mt.song_lower) >= 
      CASE WHEN is_segue THEN array_length(search_songs, 1) ELSE 1 END
  )
  SELECT 
    sm.show_id,
    s.date as show_date,
    v.name as venue_name,
    sm.proximity_score as match_score,
    sm.match_details
  FROM show_matches sm
  JOIN shows s ON sm.show_id = s.id
  LEFT JOIN venues v ON s.venue_id = v.id
  ORDER BY sm.proximity_score DESC, s.date DESC;
END;
$$ LANGUAGE plpgsql;
```

### 6. Create Indexes

```sql
-- Full text search indexes
CREATE INDEX IF NOT EXISTS shows_search_vector_idx ON shows USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS tracks_search_vector_idx ON tracks USING GIN(search_vector);

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS shows_search_text_trgm_idx ON shows USING GIN(search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tracks_search_text_trgm_idx ON tracks USING GIN(search_text gin_trgm_ops);

-- Date index for date searches
CREATE INDEX IF NOT EXISTS shows_date_idx ON shows(date);
```

### 7. Automatic Update Triggers

```sql
-- Auto-update show search fields on insert/update
CREATE OR REPLACE FUNCTION update_show_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_show_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', NEW.search_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER show_search_fields_trigger
BEFORE INSERT OR UPDATE ON shows
FOR EACH ROW EXECUTE FUNCTION update_show_search_fields();

-- Auto-update track search fields on insert/update
CREATE OR REPLACE FUNCTION update_track_search_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := build_track_search_text(NEW.id);
  NEW.search_vector := to_tsvector('english', NEW.search_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_search_fields_trigger
BEFORE INSERT OR UPDATE ON tracks
FOR EACH ROW EXECUTE FUNCTION update_track_search_fields();

-- Update show search when tracks change
CREATE OR REPLACE FUNCTION update_show_search_on_track_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE shows 
    SET search_text = build_show_search_text(OLD.show_id),
        search_vector = to_tsvector('english', build_show_search_text(OLD.show_id))
    WHERE id = OLD.show_id;
    RETURN OLD;
  ELSE
    UPDATE shows 
    SET search_text = build_show_search_text(NEW.show_id),
        search_vector = to_tsvector('english', build_show_search_text(NEW.show_id))
    WHERE id = NEW.show_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_change_update_show_search
AFTER INSERT OR UPDATE OR DELETE ON tracks
FOR EACH ROW EXECUTE FUNCTION update_show_search_on_track_change();

-- Update track search when annotations change
CREATE OR REPLACE FUNCTION update_track_search_on_annotation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE tracks 
    SET search_text = build_track_search_text(OLD.track_id),
        search_vector = to_tsvector('english', build_track_search_text(OLD.track_id))
    WHERE id = OLD.track_id;
    RETURN OLD;
  ELSE
    UPDATE tracks 
    SET search_text = build_track_search_text(NEW.track_id),
        search_vector = to_tsvector('english', build_track_search_text(NEW.track_id))
    WHERE id = NEW.track_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER annotation_change_update_track_search
AFTER INSERT OR UPDATE OR DELETE ON annotations
FOR EACH ROW EXECUTE FUNCTION update_track_search_on_annotation_change();

-- Update shows when venue changes
CREATE OR REPLACE FUNCTION update_shows_on_venue_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shows 
  SET search_text = build_show_search_text(id),
      search_vector = to_tsvector('english', build_show_search_text(id))
  WHERE venue_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_change_update_shows_search
AFTER UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION update_shows_on_venue_change();
```

### 8. Batch Update Functions

```sql
-- Function to rebuild all show search data
CREATE OR REPLACE FUNCTION rebuild_all_show_search()
RETURNS void AS $$
DECLARE
  show_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting rebuild of all show search data...';
  
  FOR show_record IN SELECT id FROM shows
  LOOP
    UPDATE shows 
    SET search_text = build_show_search_text(show_record.id),
        search_vector = to_tsvector('english', build_show_search_text(show_record.id))
    WHERE id = show_record.id;
    
    updated_count := updated_count + 1;
    
    -- Log progress every 100 shows
    IF updated_count % 100 = 0 THEN
      RAISE NOTICE 'Updated % shows...', updated_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed! Updated % total shows.', updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to rebuild all track search data
CREATE OR REPLACE FUNCTION rebuild_all_track_search()
RETURNS void AS $$
DECLARE
  track_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting rebuild of all track search data...';
  
  FOR track_record IN SELECT id FROM tracks
  LOOP
    UPDATE tracks 
    SET search_text = build_track_search_text(track_record.id),
        search_vector = to_tsvector('english', build_track_search_text(track_record.id))
    WHERE id = track_record.id;
    
    updated_count := updated_count + 1;
    
    -- Log progress every 500 tracks
    IF updated_count % 500 = 0 THEN
      RAISE NOTICE 'Updated % tracks...', updated_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed! Updated % total tracks.', updated_count;
END;
$$ LANGUAGE plpgsql;

-- Master function to rebuild everything
CREATE OR REPLACE FUNCTION rebuild_all_search_data()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Starting full search data rebuild...';
  
  -- Disable triggers temporarily for performance
  ALTER TABLE shows DISABLE TRIGGER show_search_fields_trigger;
  ALTER TABLE tracks DISABLE TRIGGER track_search_fields_trigger;
  ALTER TABLE tracks DISABLE TRIGGER track_change_update_show_search;
  
  -- Rebuild tracks first (since shows depend on track data)
  PERFORM rebuild_all_track_search();
  
  -- Then rebuild shows
  PERFORM rebuild_all_show_search();
  
  -- Re-enable triggers
  ALTER TABLE shows ENABLE TRIGGER show_search_fields_trigger;
  ALTER TABLE tracks ENABLE TRIGGER track_search_fields_trigger;
  ALTER TABLE tracks ENABLE TRIGGER track_change_update_show_search;
  
  RAISE NOTICE 'Full search data rebuild complete!';
END;
$$ LANGUAGE plpgsql;

-- Function to rebuild search for a specific date range (useful for testing)
CREATE OR REPLACE FUNCTION rebuild_search_for_date_range(start_date TEXT, end_date TEXT)
RETURNS void AS $$
DECLARE
  show_count INTEGER;
  track_count INTEGER;
BEGIN
  -- Update tracks for shows in date range
  WITH affected_shows AS (
    SELECT id FROM shows 
    WHERE date >= start_date AND date <= end_date
  )
  UPDATE tracks t
  SET search_text = build_track_search_text(t.id),
      search_vector = to_tsvector('english', build_track_search_text(t.id))
  FROM affected_shows s
  WHERE t.show_id = s.id;
  
  GET DIAGNOSTICS track_count = ROW_COUNT;
  
  -- Update shows in date range
  UPDATE shows
  SET search_text = build_show_search_text(id),
      search_vector = to_tsvector('english', build_show_search_text(id))
  WHERE date >= start_date AND date <= end_date;
  
  GET DIAGNOSTICS show_count = ROW_COUNT;
  
  RAISE NOTICE 'Updated % shows and % tracks for dates % to %', 
    show_count, track_count, start_date, end_date;
END;
$$ LANGUAGE plpgsql;
```

## TypeScript Service Implementation

### PostgresSearchService

```typescript
// packages/core/src/search/postgres-search-service.ts

import type { Logger } from "@bip/domain";
import type { DbClient } from "../_shared/database/models";

export interface SearchOptions {
  entityTypes?: string[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  entityType: 'show' | 'track' | 'song' | 'venue';
  entityId: string;
  entitySlug: string;
  displayText: string;
  score: number;
  url: string;
  metadata?: Record<string, unknown>;
}

export class PostgresSearchService {
  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);
    const { limit = 20, entityTypes } = options;

    this.logger.info(`Performing PostgreSQL search for: "${query}"`);

    try {
      // Check for date search
      if (this.looksLikeDate(query)) {
        return this.searchByDate(normalizedQuery, options);
      }

      // Check for segue search (e.g., "Above the Waves > Nughuffer")
      if (query.includes(' > ')) {
        const songs = query.split(' > ').map(s => s.trim());
        return this.searchWithProximity(songs, true, options);
      }

      // Check for multi-song search (comma or space separated)
      const songs = this.extractMultipleSongs(query);
      if (songs.length > 1) {
        return this.searchWithProximity(songs, false, options);
      }

      // Regular single-term search
      return this.performStandardSearch(normalizedQuery, options);
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      throw error;
    }
  }

  private async performStandardSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { limit = 20, entityTypes } = options;
    
    // Build entity type filter
    const entityFilter = entityTypes?.length 
      ? `AND entity_type = ANY($3)` 
      : '';

    const sql = `
      WITH search_results AS (
        -- Search shows
        SELECT 
          'show' as entity_type,
          s.id as entity_id,
          s.slug as entity_slug,
          s.date || ' • ' || COALESCE(v.name, 'Unknown Venue') as display_text,
          ts_rank(s.search_vector, query) as fts_rank,
          similarity(s.search_text, $1) as trgm_sim,
          CASE 
            WHEN s.date = $1 THEN 1.0
            WHEN s.search_text ILIKE '%' || $1 || '%' THEN 0.9
            ELSE 0
          END as exact_score
        FROM shows s
        LEFT JOIN venues v ON s.venue_id = v.id,
        plainto_tsquery('english', $1) query
        WHERE 
          (s.search_vector @@ query
           OR similarity(s.search_text, $1) > 0.2
           OR s.date LIKE $1 || '%')
          ${entityFilter}
        
        UNION ALL
        
        -- Search tracks
        SELECT 
          'track' as entity_type,
          t.id as entity_id,
          t.slug as entity_slug,
          sg.title || ' • ' || sh.date || COALESCE(' • ' || t.note, '') as display_text,
          ts_rank(t.search_vector, query) as fts_rank,
          similarity(t.search_text, $1) as trgm_sim,
          CASE
            WHEN sg.title ILIKE $1 THEN 1.0
            WHEN t.note ILIKE '%' || $1 || '%' THEN 0.8
            ELSE 0
          END as exact_score
        FROM tracks t
        JOIN songs sg ON t.song_id = sg.id
        JOIN shows sh ON t.show_id = sh.id,
        plainto_tsquery('english', $1) query
        WHERE 
          (t.search_vector @@ query
           OR similarity(t.search_text, $1) > 0.2)
          ${entityFilter}
      )
      SELECT 
        entity_type,
        entity_id,
        entity_slug,
        display_text,
        GREATEST(
          exact_score * 100,
          fts_rank * 60,
          trgm_sim * 100
        )::INTEGER as score
      FROM search_results
      ORDER BY score DESC
      LIMIT $2
    `;

    const params = entityTypes?.length 
      ? [query, limit, entityTypes]
      : [query, limit];

    const results = await this.db.$queryRawUnsafe<Array<{
      entity_type: string;
      entity_id: string;
      entity_slug: string;
      display_text: string;
      score: number;
    }>>(sql, ...params);

    return results.map(r => this.formatResult(r));
  }

  private async searchByDate(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { limit = 20 } = options;

    const sql = `
      SELECT 
        'show' as entity_type,
        s.id as entity_id,
        s.slug as entity_slug,
        s.date || ' • ' || COALESCE(v.name, 'Unknown Venue') as display_text,
        100 as score
      FROM shows s
      LEFT JOIN venues v ON s.venue_id = v.id
      WHERE search_date_match(s.date, $1)
      ORDER BY s.date DESC
      LIMIT $2
    `;

    const results = await this.db.$queryRawUnsafe<Array<{
      entity_type: string;
      entity_id: string;
      entity_slug: string;
      display_text: string;
      score: number;
    }>>(sql, query, limit);

    return results.map(r => this.formatResult(r));
  }

  private async searchWithProximity(songs: string[], isSegue: boolean, options: SearchOptions): Promise<SearchResult[]> {
    const { limit = 20 } = options;

    const results = await this.db.$queryRawUnsafe<Array<{
      show_id: string;
      show_date: string;
      venue_name: string;
      match_score: number;
      match_details: string;
    }>>(
      `SELECT * FROM search_shows_with_songs($1::TEXT[], $2::BOOLEAN) LIMIT $3`,
      songs,
      isSegue,
      limit
    );

    return results.map(r => ({
      id: r.show_id,
      entityType: 'show' as const,
      entityId: r.show_id,
      entitySlug: r.show_date,
      displayText: `${r.show_date} • ${r.venue_name || 'Unknown Venue'}`,
      score: r.match_score,
      url: `/shows/${r.show_date}`,
      metadata: {
        matchDetails: r.match_details
      }
    }));
  }

  private formatResult(row: any): SearchResult {
    let url = '/';
    
    switch (row.entity_type) {
      case 'show':
        url = `/shows/${row.entity_slug}`;
        break;
      case 'song':
        url = `/songs/${row.entity_slug}`;
        break;
      case 'venue':
        url = `/venues/${row.entity_slug}`;
        break;
      case 'track':
        url = `/tracks/${row.entity_id}`;
        break;
    }

    return {
      id: row.entity_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entitySlug: row.entity_slug,
      displayText: row.display_text,
      score: Math.min(100, Math.round(row.score)),
      url
    };
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase();
  }

  private looksLikeDate(query: string): boolean {
    const datePatterns = [
      /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/,  // 12/30/99, 12-30-1999
      /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/,     // 1999-12-30
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,  // December 30
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i  // 30 Dec
    ];
    
    return datePatterns.some(pattern => pattern.test(query.trim()));
  }

  private extractMultipleSongs(query: string): string[] {
    // Split by comma or "and"
    const songs = query
      .split(/,|\sand\s/i)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return songs;
  }

  async getStats(): Promise<{
    totalShows: number;
    totalTracks: number;
    showsWithSearch: number;
    tracksWithSearch: number;
  }> {
    const stats = await this.db.$queryRaw<Array<{
      total_shows: bigint;
      total_tracks: bigint;
      shows_with_search: bigint;
      tracks_with_search: bigint;
    }>>`
      SELECT 
        (SELECT COUNT(*) FROM shows)::BIGINT as total_shows,
        (SELECT COUNT(*) FROM tracks)::BIGINT as total_tracks,
        (SELECT COUNT(*) FROM shows WHERE search_text IS NOT NULL)::BIGINT as shows_with_search,
        (SELECT COUNT(*) FROM tracks WHERE search_text IS NOT NULL)::BIGINT as tracks_with_search
    `;

    const result = stats[0];
    return {
      totalShows: Number(result.total_shows),
      totalTracks: Number(result.total_tracks),
      showsWithSearch: Number(result.shows_with_search),
      tracksWithSearch: Number(result.tracks_with_search)
    };
  }
}
```

## Migration Steps

### 1. Create and Run Migration

```bash
# Generate migration timestamp
npx prisma migrate dev --create-only --name add_postgres_text_search

# Copy the SQL from this document into the migration file

# Run the migration
npx prisma migrate dev
```

### 2. Populate Search Data

```sql
-- Initial population of all search data
SELECT rebuild_all_search_data();

-- Or populate incrementally for testing
SELECT rebuild_search_for_date_range('2024-01-01', '2024-12-31');
```

### 3. Update API Endpoint

```typescript
// apps/web/app/routes/api/search.tsx

import { PostgresSearchService } from "@bip/core";

export const action = publicLoader(async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { query, entityTypes, limit = 20 } = body;

  const searchService = new PostgresSearchService(db, logger);
  const results = await searchService.search(query, { entityTypes, limit });

  return new Response(JSON.stringify({
    results,
    query,
    totalResults: results.length,
    executionTimeMs: 0 // Can add timing if needed
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
```

### 4. Testing Queries

```sql
-- Test date search
SELECT * FROM shows WHERE search_date_match(date, '12/30/99');
SELECT * FROM shows WHERE search_date_match(date, 'dec 30 1999');

-- Test segue search
SELECT * FROM search_shows_with_songs(ARRAY['Above the Waves', 'Nughuffer'], true);

-- Test multi-song search
SELECT * FROM search_shows_with_songs(ARRAY['Basis', 'Boom Shanker'], false);

-- Test standard search
SELECT 
  entity_type,
  display_text,
  ts_rank(search_vector, plainto_tsquery('english', 'crystal')) as rank
FROM (
  SELECT 'show' as entity_type, search_text, search_vector, 
         date || ' • ' || 'venue' as display_text
  FROM shows
) combined
WHERE search_vector @@ plainto_tsquery('english', 'crystal')
ORDER BY rank DESC;
```

## Cleanup After Migration

Once the new search is working and verified:

1. Remove old SearchIndex model from Prisma schema
2. Delete old search-related files:
   - `search-index-service.ts`
   - `embedding-service.ts` 
   - `search-index-repository.ts`
   - `search-result-aggregator.ts`
3. Remove OpenAI API key from environment
4. Drop old search_indexes table:
   ```sql
   DROP TABLE IF EXISTS search_indexes;
   ```

## Performance Considerations

- Initial population will take time (estimate: ~1-2 minutes for 10k shows)
- Triggers add minimal overhead to writes
- Search queries should return in <100ms for most cases
- Consider adding caching layer for popular searches
- Monitor index bloat and VACUUM regularly

## Monitoring

Track these metrics:
- Search query response times
- Most common search terms
- Failed searches (no results)
- Index sizes and bloat
- Trigger execution times