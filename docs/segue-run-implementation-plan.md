# SegueRun Model & Multi-Stage Query Parsing Implementation Plan

## Overview
Create a new `SegueRun` model to pre-compute segue sequences and implement a multi-stage query parser to handle complex searches like "new york little shimmy > basis".

## Part 1: SegueRun Model

### Database Schema
```prisma
model SegueRun {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  showId       String   @map("show_id") @db.Uuid
  set          String   @db.VarChar // "S1", "S2", "E1", "E2" etc - matches track.set format
  trackIds     String[] @map("track_ids") @db.Uuid
  sequence     String   // "Terrapin Station > Playing in the Band > Uncle Johns Band"
  length       Int      // 3 (number of songs)
  searchText   String   @map("search_text") @db.Text
  searchVector Unsupported("tsvector")? @map("search_vector")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  show Show @relation(fields: [showId], references: [id])
  @@map("segue_runs")
}
```

### SegueRun Generation Logic
- Analyze existing shows to extract consecutive tracks with segues
- Create SegueRuns for sequences of 2+ songs within the same set
- Store the set identifier ("S1", "S2", "E1", "E2") matching track.set format
- Normalize all segue symbols to `>` 
- Store both display sequence and search-optimized text
- Handle sequences that span entire sets (5-6 songs common)
- Each SegueRun belongs to exactly one set - segues don't cross set boundaries

## Part 2: Multi-Stage Query Parser

Based on academic research on structured entity extraction, implement a 4-stage parsing system:

### Stage 1: Structural Parsing
- Detect `>` symbols in search query
- Split query into segments: `"new york little shimmy > basis"` → `["new york little shimmy", "basis"]`
- Preserve segue structure and ordering

### Stage 2: Entity Type Classification  
For each segment, run parallel entity searches:
- **Venue Search**: Query each segment against venues using pg_trgm
- **Song Search**: Query each segment against songs using pg_trgm
- **Hybrid Segments**: Handle segments that could contain both venue and song terms

### Stage 3: Disambiguation Through Scoring
- Score all possible entity combinations
- Example for "new york little shimmy > basis":
  - Venue "New York" (90%) + Song "Little Shimmy in a Conga Line" (85%)
  - Song "New York Minute" (70%) + Song "Little Shimmy in a Conga Line" (85%)
- Use trigram similarity + exact match bonuses

### Stage 4: Best Parse Selection
- Select highest-scoring valid combination
- Output structured result:
  ```typescript
  {
    venues: ["new-york-venue-id"],
    segueSequence: ["little-shimmy-song-id", "basis-for-a-day-song-id"]
  }
  ```

## Part 3: Search Integration

### SegueRun Search Process
1. Parse query using multi-stage parser
2. If segue sequence found, search SegueRuns table:
   - Find runs containing the song sequence in order
   - Support partial matching (2-song search matches 6-song run)
   - Use `WHERE LOWER(sequence) LIKE '%little shimmy in a conga line > basis for a day%'`
3. Apply venue filters to resulting shows
4. Return shows with SegueRun match context

### Search Result Enhancement  
- Display segue context in search results
- Highlight matched portion of longer sequences
- Score segue matches appropriately vs individual song matches
- Maintain existing song/venue/track search functionality

## Part 4: Implementation Steps

1. **Create SegueRun Migration**: Add table, indexes, relations
2. **Build SegueRun Generator**: Service to create runs from existing track data
3. **Implement Query Parser**: Multi-stage entity extraction system
4. **Integrate with Search**: Add SegueRun search to PostgresSearchService
5. **Update Search UI**: Display segue run results appropriately
6. **Background Population**: Generate SegueRuns for all existing shows

## Benefits

- **Performance**: Pre-computed segue sequences eliminate complex real-time joins
- **Accuracy**: Multi-stage parsing handles venue+song disambiguation systematically  
- **Flexibility**: Supports partial matching within longer segue sequences
- **Consistency**: Treats segues as first-class searchable entities like songs/venues
- **Scalability**: Clean separation allows independent optimization of each stage

## Technical Considerations

### Query Examples and Expected Behavior

| Query | Parse Result | Search Behavior |
|-------|-------------|----------------|
| `"terrapin > playing"` | `{segueSequence: ["terrapin-id", "playing-id"]}` | Find SegueRuns containing this sequence |
| `"new york terrapin > playing"` | `{venues: ["ny-id"], segueSequence: ["terrapin-id", "playing-id"]}` | Filter by venue AND segue sequence |
| `"terrapin > playing > uncle"` | `{segueSequence: ["terrapin-id", "playing-id", "uncle-id"]}` | 3-song sequence search |
| `"basis"` | `{songs: ["basis-id"]}` | Fall back to regular song search |

### Scoring Strategy
- **Exact sequence matches**: 100 points
- **Partial sequence matches**: 70-90 points based on position and length
- **Venue + segue matches**: Combined scoring
- **Individual song fallback**: Existing song match scoring

### Performance Optimizations
- Index `searchVector` for full-text search
- Index `trackIds` for array operations
- Consider materialized views for common sequence patterns
- Batch generation of SegueRuns for efficiency