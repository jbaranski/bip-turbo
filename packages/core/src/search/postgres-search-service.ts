import type { Logger, SearchResult } from "@bip/domain";
import type { DbClient } from "../_shared/database/models";
import { SegueQueryParser } from "./segue-query-parser";

type VenueResult = {
  venue_id: string;
  venue_name: string;
  venue_slug: string;
  match_score: number;
};

type SongResult = {
  song_id: string;
  song_title: string;
  song_slug: string;
  match_score: number;
};

type ShowResult = {
  show_id: string;
  show_slug: string;
  show_date: string;
  venue_name: string | null;
  venue_city: string | null;
  venue_state: string | null;
  venue_country: string | null;
  match_score: number;
  match_details: string;
};

export interface SearchOptions {
  limit: number;
}

export class PostgresSearchService {
  private segueQueryParser: SegueQueryParser;

  constructor(
    private readonly db: DbClient,
    private readonly logger: Logger,
  ) {
    this.segueQueryParser = new SegueQueryParser(db, logger);
  }

  async search(query: string, options: SearchOptions = { limit: 30 }): Promise<SearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);

    this.logger.info(`Performing PostgreSQL search for: "${query}"`);

    try {
      // Check for date search
      if (this.looksLikeDate(query)) {
        return this.searchByDate(normalizedQuery, options);
      }

      // Check for segue search (contains ">")
      if (query.includes(">")) {
        return this.searchWithSegues(query, options);
      }

      // Search for songs
      const songResults = await this.performSongSearch(normalizedQuery);
      const songIds = songResults.filter((s) => s.match_score >= 30).map((s) => s.song_id);

      // Search for venues
      const venueResults = await this.performVenueSearch(normalizedQuery);
      const venueIds = venueResults.filter((v) => v.match_score >= 1).map((v) => v.venue_id);

      // Return no results if we have no date, song, or venue results
      if (songIds.length === 0 && venueIds.length === 0) {
        return [];
      }

      // Perform unified search with songs and/or venues
      const showResults = await this.performShowSearch(normalizedQuery, songIds, venueIds, options.limit);

      return this.formatShowResults(showResults);
    } catch (error) {
      this.logger.error(`Search failed: ${error}`);
      throw error;
    }
  }

  private formatShowResults(showResults: ShowResult[]): SearchResult[] {
    return showResults.map((r) => {
      const formattedDate = r.show_date.includes("/") ? r.show_date : new Date(r.show_date).toLocaleDateString("en-US");

      // Build venue location string
      let venueLocation = null;
      if (r.venue_city && r.venue_state) {
        venueLocation = `${r.venue_city}, ${r.venue_state}`;
      } else if (r.venue_country) {
        venueLocation = r.venue_country;
      }

      let displayText = `${formattedDate} • ${r.venue_name || "Unknown Venue"}`;
      if (venueLocation) {
        displayText += ` • ${venueLocation}`;
      }

      return {
        id: r.show_id,
        entityType: "show" as const,
        entityId: r.show_id,
        entitySlug: r.show_slug,
        displayText,
        score: r.match_score,
        url: `/shows/${r.show_slug}`,
        date: formattedDate,
        venueName: r.venue_name || undefined,
        venueLocation: venueLocation || undefined,
        metadata: {
          matchDetails: r.match_details,
        },
      };
    });
  }

  private async performVenueSearch(query: string): Promise<VenueResult[]> {
    return this.db.$queryRawUnsafe<VenueResult[]>(
      `
        WITH search_matches AS (
          SELECT
            v.id as venue_id,
            v.name as venue_name,
            v.slug as venue_slug,
            ts_rank(v.search_vector, plainto_tsquery('english', $1)) as fts_rank,
            similarity(v.search_text, $1) as trgm_sim,
            CASE
              WHEN LOWER(v.name) = LOWER($1) THEN 1.0
              WHEN LOWER(v.name) LIKE LOWER($1) || '%' THEN 0.9
              WHEN LOWER(v.name) LIKE '%' || LOWER($1) || '%' THEN 0.8
              WHEN LOWER(v.city) = LOWER($1) THEN 0.7
              WHEN LOWER(v.city) LIKE '%' || LOWER($1) || '%' THEN 0.6
              ELSE 0
            END as exact_score
          FROM venues v
          WHERE
            v.search_vector @@ plainto_tsquery('english', $1)
            OR similarity(v.search_text, $1) > 0.10  -- 10% threshold
            OR LOWER(v.name) LIKE '%' || LOWER($1) || '%'

            OR LOWER(v.city) LIKE '%' || LOWER($1) || '%'
        )
        SELECT
          venue_id,
          venue_name,
          venue_slug,
          GREATEST(
            exact_score * 200,  -- Double weight for exact matches
            fts_rank * 60,
            trgm_sim * 100
          )::INTEGER as match_score
        FROM search_matches
        ORDER BY match_score DESC
        LIMIT 100
      `,
      query,
    );
  }

  private async performSongSearch(query: string): Promise<SongResult[]> {
    // Inline SQL from search_songs function - easier to debug and modify
    const sql = `
      WITH search_matches AS (
        SELECT 
          s.id as song_id,
          s.title as song_title,
          s.slug as song_slug,
          ts_rank(s.search_vector, plainto_tsquery('english', $1)) as fts_rank,
          similarity(s.search_text, $1) as trgm_sim,
          CASE 
            WHEN LOWER(s.title) = LOWER($1) THEN 1.0
            WHEN LOWER(s.title) LIKE LOWER($1) || '%' THEN 0.9
            WHEN LOWER(s.title) LIKE '%' || LOWER($1) || '%' THEN 0.8
            ELSE 0
          END as exact_score,
          s.times_played
        FROM songs s
        WHERE 
          s.search_vector @@ plainto_tsquery('english', $1)
          OR similarity(s.search_text, $1) > 0.2
          OR LOWER(s.title) LIKE '%' || LOWER($1) || '%'
      )
      SELECT 
        song_id,
        song_title::TEXT,
        song_slug::TEXT,
        GREATEST(
          exact_score * 100,
          fts_rank * 60,
          trgm_sim * 100
        )::INTEGER as match_score
      FROM search_matches
      ORDER BY match_score DESC, times_played DESC
      LIMIT 10
    `;

    this.logger.debug(`Song search SQL for query "${query}"`);
    return this.db.$queryRawUnsafe<SongResult[]>(sql, query);
  }

  private async performShowSearch(
    query: string,
    songIds: string[],
    venueIds: string[],
    limit: number,
  ): Promise<ShowResult[]> {
    this.logger.info(`Show search: ${songIds.length} songs, ${venueIds.length} venues from query: "${query}"`);

    // If we only have venues (no songs), do a simple venue-based show search
    if (venueIds.length > 0 && songIds.length === 0) {
      // Pure venue search - just return shows at those venues
      return this.db.$queryRawUnsafe<ShowResult[]>(
        `
        SELECT 
          s.id as show_id,
          s.slug as show_slug,
          s.date::TEXT as show_date,
          v.name as venue_name,
          v.city as venue_city,
          v.state as venue_state,
          v.country as venue_country,
          100 as match_score,
          json_build_object(
            'type', 'venueMatch',
            'venue', v.name,
            'city', v.city,
            'state', v.state
          )::text as match_details
        FROM shows s
        JOIN venues v ON s.venue_id = v.id
        WHERE s.venue_id = ANY($1::UUID[])
        ORDER BY s.date DESC
        LIMIT $2
      `,
        venueIds,
        limit,
      );
    }

    // Inline the complex show search SQL for better debugging and flexibility
    const sql = this.buildShowSearchSQL(query, songIds, venueIds, limit);

    this.logger.debug(`Show search SQL - songs: ${songIds.length}, venues: ${venueIds.length}`);

    return this.db.$queryRawUnsafe<ShowResult[]>(sql);
  }

  private async searchByDate(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const { limit = 20 } = options;

    const sql = `
      WITH enriched_results AS (
        SELECT 
          'show' as entity_type,
          s.id as entity_id,
          s.slug as entity_slug,
          100 as score,
          s.date,
          s.slug as show_slug,
          v.name as venue_name,
          v.city as venue_city,
          v.state as venue_state,
          v.country as venue_country
        FROM shows s
        LEFT JOIN venues v ON s.venue_id = v.id
        WHERE search_date_match(s.date, $1)
      )
      SELECT 
        entity_type,
        entity_id,
        entity_slug,
        score,
        TO_CHAR(date::DATE, 'MM/DD/YYYY') as date_str,
        venue_name,
        CASE 
          WHEN venue_city IS NOT NULL AND venue_state IS NOT NULL THEN venue_city || ', ' || venue_state
          WHEN venue_country IS NOT NULL THEN venue_country
          ELSE NULL
        END as venue_location,
        NULL::TEXT as song_title,
        NULL::TEXT as track_annotation,
        NULL::TEXT as set_info,
        NULL::TEXT as track_position,
        NULL::TEXT as prev_song_title,
        NULL::TEXT as next_song_title,
        NULL::TEXT as track_segue,
        show_slug
      FROM enriched_results
      ORDER BY date DESC
      LIMIT $2
    `;

    const results = await this.db.$queryRawUnsafe<
      Array<{
        entity_type: string;
        entity_id: string;
        entity_slug: string;
        score: number;
        date_str: string;
        venue_name: string | null;
        venue_location: string | null;
        song_title: string | null;
        track_annotation: string | null;
        set_info: string | null;
        track_position: string | null;
        prev_song_title: string | null;
        next_song_title: string | null;
        track_segue: string | null;
        show_slug: string;
      }>
    >(sql, query, limit);

    return results.map((r) => this.formatResult(r));
  }


  private formatResult(row: any): SearchResult {
    const baseResult: SearchResult = {
      id: row.entity_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entitySlug: row.entity_slug,
      displayText: "", // We'll build this
      score: Math.min(100, Math.round(row.score)),
      url: `/shows/${row.show_slug || row.entity_slug}`,
      date: row.date_str,
      venueName: row.venue_name,
      venueLocation: row.venue_location,
      songTitle: row.song_title,
      annotation: row.track_annotation,
      setInfo: row.set_info,
      trackPosition: row.track_position,
      prevSong: row.prev_song_title,
      nextSong: row.next_song_title,
      segueType: row.track_segue,
    };

    // Build display text based on entity type
    if (row.entity_type === "show") {
      baseResult.displayText = `${row.date_str} • ${row.venue_name || "Unknown Venue"}${row.venue_location ? " • " + row.venue_location : ""}`;
    } else if (row.entity_type === "track") {
      // Format: Date • Venue • City, State
      // Song before (segue), Song Name, Song after (segue) (annotation, set info)
      let trackDisplay = `${row.date_str} • ${row.venue_name || "Unknown Venue"}`;
      if (row.venue_location) {
        trackDisplay += ` • ${row.venue_location}`;
      }

      // Add song context
      let songContext = "";
      if (row.prev_song_title) {
        songContext += row.prev_song_title + (row.track_segue === ">" ? " > " : ", ");
      }
      songContext += `**${row.song_title}**`;
      if (row.next_song_title && row.track_segue) {
        songContext += (row.track_segue === ">" ? " > " : ", ") + row.next_song_title;
      }

      // Add annotation and set info
      let extraInfo = "";
      if (row.track_annotation) {
        extraInfo += row.track_annotation;
      }
      if (row.set_info) {
        extraInfo += (extraInfo ? ", " : "") + row.set_info;
      }
      if (extraInfo) {
        songContext += ` (${extraInfo})`;
      }

      baseResult.displayText = trackDisplay + "\n" + songContext;
    }

    return baseResult;
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase();
  }

  private buildShowSearchSQL(
    searchTerm: string,
    songIds: string[], 
    venueIds: string[], 
    limit: number
  ): string {
    // Properly escape and format arrays for SQL
    const searchTermSQL = `'${searchTerm.replace(/'/g, "''")}'`;
    const songIdsSQL = songIds.length > 0 
      ? `ARRAY[${songIds.map(id => `'${id}'::UUID`).join(',')}]`
      : 'NULL::UUID[]';
    const venueIdsSQL = venueIds.length > 0
      ? `ARRAY[${venueIds.map(id => `'${id}'::UUID`).join(',')}]`
      : 'NULL::UUID[]';
    
    return `
      WITH filtered_shows AS (
        SELECT s.id, s.slug, s.date, s.venue_id
        FROM shows s
        WHERE ${venueIdsSQL} IS NULL OR s.venue_id = ANY(${venueIdsSQL})
      ),
      filtered_tracks AS (
        SELECT 
          t.show_id,
          t.id as track_id,
          t.position,
          t.set,
          t.note,
          s.title as song_title,
          s.id as song_id,
          LOWER(s.title) as song_lower,
          t.next_track_id,
          LAG(s2.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as prev_song,
          LEAD(s3.title) OVER (PARTITION BY t.show_id ORDER BY t.position) as next_song
        FROM tracks t
        JOIN songs s ON t.song_id = s.id
        JOIN filtered_shows fs ON t.show_id = fs.id
        LEFT JOIN tracks t2 ON t2.next_track_id = t.id
        LEFT JOIN songs s2 ON t2.song_id = s2.id
        LEFT JOIN tracks t3 ON t.next_track_id = t3.id
        LEFT JOIN songs s3 ON t3.song_id = s3.id
        WHERE ${songIdsSQL} IS NULL OR t.song_id = ANY(${songIdsSQL})
      ),
      matched_tracks AS (
        SELECT 
          ft.*,
          CASE 
            WHEN ${songIdsSQL} IS NOT NULL THEN 100
            WHEN ft.song_lower LIKE '%' || LOWER(${searchTermSQL}) || '%' THEN 70
            ELSE 30
          END as song_match_score,
          CASE WHEN ${songIdsSQL} IS NOT NULL THEN true ELSE false END as is_exact_match
        FROM filtered_tracks ft
        WHERE 
          ${songIdsSQL} IS NOT NULL
          OR
          (${songIdsSQL} IS NULL AND ft.song_lower LIKE '%' || LOWER(${searchTermSQL}) || '%')
      ),
      show_matches AS (
        SELECT 
          mt.show_id AS match_show_id,
          GREATEST(50, MAX(mt.song_match_score)) + 
          CASE 
            WHEN ${venueIdsSQL} IS NOT NULL THEN 50
            ELSE 0
          END as final_score,
          json_build_object(
            'type', 'trackMatches',
            'tracks', json_agg(
              json_build_object(
                'song', mt.song_title,
                'position', mt.position,
                'set', mt.set,
                'note', mt.note,
                'prevSong', mt.prev_song,
                'nextSong', mt.next_song,
                'isExactMatch', mt.is_exact_match,
                'isOpener', CASE WHEN mt.position = 1 THEN true ELSE false END,
                'isCloser', CASE WHEN mt.next_track_id IS NULL THEN true ELSE false END
              ) ORDER BY mt.position
            )
          )::text as match_details
        FROM matched_tracks mt
        GROUP BY mt.show_id
      )
      SELECT 
        sm.match_show_id as show_id,
        sh.slug::TEXT as show_slug,
        sh.date::TEXT as show_date,
        v.name::TEXT as venue_name,
        v.city::TEXT as venue_city,
        v.state::TEXT as venue_state,
        v.country::TEXT as venue_country,
        sm.final_score::INTEGER as match_score,
        sm.match_details::TEXT as match_details
      FROM show_matches sm
      JOIN shows sh ON sm.match_show_id = sh.id
      LEFT JOIN venues v ON sh.venue_id = v.id
      ORDER BY sm.final_score DESC, sh.date DESC
      LIMIT ${limit}
    `;
  }

  private async searchWithSegues(query: string, options: SearchOptions): Promise<SearchResult[]> {
    this.logger.info(`Performing segue search for: "${query}"`);

    // Parse the query to extract venue and segue sequence
    const parsed = await this.segueQueryParser.parse(query);
    
    if (parsed.segueSequence.length < 2) {
      // Not a valid segue search, fall back to regular search
      const showResults = await this.performShowSearch(this.normalizeQuery(query), [], [], options.limit);
      return this.convertShowResultsToSearchResults(showResults);
    }

    // Find matching segue runs with their IDs
    const matchingRuns = await this.segueQueryParser.findMatchingSegueRuns(parsed.segueSequence);
    
    if (matchingRuns.length === 0) {
      return [];
    }

    // Apply venue filter if present
    let filteredRuns = matchingRuns;
    if (parsed.venues.length > 0) {
      const showIds = matchingRuns.map(r => r.showId);
      const showsAtVenues = await this.db.show.findMany({
        where: {
          id: { in: showIds },
          venueId: { in: parsed.venues }
        },
        select: { id: true }
      });
      const validShowIds = new Set(showsAtVenues.map(s => s.id));
      filteredRuns = matchingRuns.filter(r => validShowIds.has(r.showId));
    }

    // Get the segue run IDs
    const segueRunIds = filteredRuns.map(r => r.segueRunId);

    // Get show details with the SPECIFIC segue run info
    const results = await this.db.$queryRaw<ShowResult[]>`
      SELECT 
        sh.id as show_id,
        sh.slug as show_slug,
        sh.date as show_date,
        v.name as venue_name,
        v.city as venue_city,
        v.state as venue_state,
        v.country as venue_country,
        100 as match_score,
        json_build_object(
          'type', 'segueMatch',
          'segueRun', json_build_object(
            'sequence', sr.sequence,
            'set', sr.set,
            'length', sr.length
          )
        )::text as match_details
      FROM segue_runs sr
      JOIN shows sh ON sr.show_id = sh.id
      LEFT JOIN venues v ON sh.venue_id = v.id
      WHERE sr.id = ANY(${segueRunIds}::uuid[])
      ORDER BY sh.date DESC
      LIMIT ${options.limit}
    `;

    return this.convertShowResultsToSearchResults(results);
  }

  private looksLikeDate(query: string): boolean {
    const datePatterns = [
      /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/, // 12/30/99, 12-30-1999
      /^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$/, // 1999-12-30
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // December 30
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // 30 Dec
    ];

    return datePatterns.some((pattern) => pattern.test(query.trim()));
  }

  private convertShowResultsToSearchResults(showResults: ShowResult[]): SearchResult[] {
    return showResults.map(show => ({
      id: show.show_id,
      entityType: 'show' as const,
      entityId: show.show_id,
      entitySlug: show.show_slug,
      displayText: `${show.show_date} • ${show.venue_name || 'Unknown Venue'}${show.venue_city ? ` • ${show.venue_city}` : ''}${show.venue_state ? `, ${show.venue_state}` : ''}`,
      score: Math.min(100, Math.round(show.match_score)),
      url: `/shows/${show.show_slug}`,
      date: show.show_date,
      venueName: show.venue_name || undefined,
      venueLocation: show.venue_city && show.venue_state ? `${show.venue_city}, ${show.venue_state}` : show.venue_city || show.venue_state || undefined,
      metadata: show.match_details ? { matchDetails: show.match_details } : undefined,
    }));
  }

  async rebuildSearchData(): Promise<void> {
    this.logger.info("Rebuilding all search data...");

    try {
      await this.db.$executeRawUnsafe(`SELECT rebuild_all_search_data()`);
      this.logger.info("Search data rebuild complete");
    } catch (error) {
      this.logger.error(`Failed to rebuild search data: ${error}`);
      throw error;
    }
  }

  async rebuildSearchForDateRange(startDate: string, endDate: string): Promise<void> {
    this.logger.info(`Rebuilding search data for ${startDate} to ${endDate}...`);

    try {
      await this.db.$executeRawUnsafe(`SELECT rebuild_search_for_date_range($1, $2)`, startDate, endDate);
      this.logger.info(`Search data rebuild complete for date range`);
    } catch (error) {
      this.logger.error(`Failed to rebuild search data for date range: ${error}`);
      throw error;
    }
  }
}
