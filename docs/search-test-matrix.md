# Search Test Matrix

This document contains comprehensive test cases for the search functionality. Each test case includes:
- **Query**: The search term to test
- **Expected Type**: What kind of results should be returned
- **Expected Count**: Approximate number of results expected (Min/Max range)
- **Priority**: Critical/High/Medium/Low
- **Notes**: Additional context about what should be found

## Test Categories

### 1. Date Searches (Basic Entity Tests)

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `12/30/99` | Shows | 1-3 | Critical | Should find 12/30/1999 shows |
| `12/30` | Shows | 5-20 | High | Should find shows on 12/30 across years |
| `12/30/1999` | Shows | 1-3 | Critical | Exact date match |
| `1999` | Shows | 50-200 | High | All shows in 1999 |
| `Dec 99` | Shows | 10-50 | Medium | December 1999 shows |
| `Dec 1999` | Shows | 10-50 | Medium | December 1999 shows |
| `1999/12/30` | Shows | 1-3 | Medium | Alternative date format |
| `December 30 1999` | Shows | 1-3 | Medium | Full date written out |
| `99` | Shows | 50-200 | Low | Should interpret as 1999 |

### 2. Song Searches (Basic Entity Tests)

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Shimmy` | Shows | 20-100 | Critical | Shows with any Shimmy song |
| `Little Shimmy` | Shows | 15-80 | Critical | Shows with "Little Shimmy in a Conga Line" |
| `Little Shimmy in a Conga Line` | Shows | 15-80 | Critical | Exact song title match |
| `Shimmy inverted` | Shows | 1-10 | High | Shows with inverted Shimmy |
| `Shimmy unfinished` | Shows | 1-5 | High | Shows with unfinished Shimmy |
| `Shimmy S1 opener` | Shows | 3-15 | Medium | Shows where Shimmy opened set 1 |
| `Shimmy S2 closer` | Shows | 1-8 | Medium | Shows where Shimmy closed set 2 |
| `Lunar Pursuit` | Shows | 5-25 | Critical | This was failing - exact song match |
| `Basis for a Day` | Shows | 30-150 | Critical | Popular song |
| `Basis` | Shows | 30-150 | High | Should match "Basis for a Day" |
| `House Dog` | Shows | 10-40 | High | Should find "House Dog Party Favor" |

### 3. Venue Searches (Basic Entity Tests)

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Wetlands` | Shows | 20-80 | Critical | Famous venue |
| `NY` | Shows | 50-200 | High | New York shows |
| `New York` | Shows | 50-200 | Critical | New York shows |
| `Boston` | Shows | 20-80 | Critical | Boston shows |
| `MA` | Shows | 20-80 | Medium | Massachusetts shows |
| `Massachusetts` | Shows | 20-80 | Medium | Massachusetts shows |
| `The Fillmore` | Shows | 5-30 | High | Fillmore venue |
| `Fillmore` | Shows | 5-30 | High | Should match "The Fillmore" |
| `Las Vegas` | Shows | 3-20 | Medium | Vegas shows |
| `New Jersey` | Shows | 10-50 | Medium | NJ shows |
| `Amsterdam` | Shows | 2-15 | Low | International shows |

### 4. Segue Searches (Basic Entity Tests)

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Shimmy > Basis` | Shows | 3-15 | Critical | Basic segue search |
| `Basis > Shimmy > Basis` | Shows | 1-5 | High | Multi-song segue |
| `Little Shimmy in a Conga Line > Basis` | Shows | 2-10 | Critical | Full song name segue |
| `I-Man > Freeze` | Shows | 1-8 | High | Known segue combination |
| `Hot Air Balloon > Above the Waves` | Shows | 1-5 | Medium | Less common segue |

### 5. Combined Date + Song Searches

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `1999 Shimmy` | Shows | 5-30 | Critical | Shows in 1999 with Shimmy |
| `12/30/99 Little Shimmy` | Shows | 0-2 | Critical | Specific date + song |
| `Dec 1999 Basis` | Shows | 2-15 | High | Month/year + song |
| `1999 Lunar Pursuit` | Shows | 1-8 | High | Year + specific song |
| `12/30 Shimmy` | Shows | 1-10 | High | Date across years + song |
| `2000 House Dog` | Shows | 2-12 | Medium | Year + song |
| `99 Basis for a Day` | Shows | 3-20 | Medium | Short year + song |

### 6. Combined Venue + Song Searches

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Wetlands House Dog` | Shows | 1-8 | Critical | Venue + song |
| `Boston Shimmy Bombs` | Shows | 0-3 | Critical | City + multiple songs |
| `NY Little Shimmy` | Shows | 3-20 | High | State + song |
| `New York Basis` | Shows | 5-25 | Critical | City + song |
| `Fillmore Lunar Pursuit` | Shows | 0-3 | High | Venue + song |
| `Massachusetts Shimmy` | Shows | 2-15 | Medium | State + song |
| `Las Vegas Basis` | Shows | 0-5 | Medium | City + song |
| `Wetlands Shimmy inverted` | Shows | 0-2 | High | Venue + song annotation |
| `Boston House Dog Party Favor` | Shows | 0-5 | Medium | City + full song name |

### 7. Combined Date + Venue Searches

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `12/30/99 Wetlands` | Shows | 0-1 | High | Specific date + venue |
| `1999 Fillmore` | Shows | 2-10 | High | Year + venue |
| `Dec 1999 Boston` | Shows | 1-8 | Medium | Month/year + city |
| `99 New York` | Shows | 8-40 | Medium | Year + city |
| `12/30 Wetlands` | Shows | 0-3 | Medium | Date + venue across years |

### 8. Combined Date + Venue + Song Searches

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `12/30/99 Wetlands Shimmy` | Shows | 0-1 | Critical | Triple combination |
| `1999 Boston Little Shimmy` | Shows | 1-5 | High | Year + city + song |
| `Dec 1999 NY Basis` | Shows | 0-3 | High | Month/year + state + song |
| `2000 Fillmore House Dog` | Shows | 0-2 | Medium | Year + venue + song |
| `99 Massachusetts Shimmy inverted` | Shows | 0-1 | Medium | Year + state + song annotation |

### 9. Complex Segue Searches with Context

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `12/30 vassillios > little lai > run like hell` | Shows | 0-2 | Critical | Date + complex segue |
| `Wetlands Shimmy > Basis` | Shows | 0-3 | High | Venue + segue |
| `1999 I-Man > Freeze` | Shows | 0-2 | High | Year + segue |
| `NY Little Shimmy > Basis for a Day` | Shows | 0-5 | High | State + segue |
| `Boston Basis > Shimmy > Basis` | Shows | 0-1 | Medium | City + multi-song segue |

### 10. Song Annotation/Position Searches

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Shimmy opener` | Shows | 5-20 | High | Shows where Shimmy opened |
| `Basis closer` | Shows | 3-15 | High | Shows where Basis closed |
| `Little Shimmy encore` | Shows | 2-10 | Medium | Shimmy in encore |
| `House Dog S1` | Shows | 3-12 | Medium | Song in set 1 |
| `Lunar Pursuit S2` | Shows | 1-8 | Medium | Song in set 2 |
| `Shimmy inverted opener` | Shows | 0-3 | High | Inverted Shimmy as opener |
| `Basis unfinished closer` | Shows | 0-2 | Medium | Unfinished song as closer |

### 11. Complex Multi-Word Venue + Song Combinations

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `The Fillmore Little Shimmy in a Conga Line` | Shows | 0-3 | High | Full venue + full song |
| `Showtime at the Drive-In Basis` | Shows | 0-3 | Medium | Complex venue + song |
| `Theater of the Living Arts House Dog` | Shows | 0-2 | Medium | Long venue + song |
| `Hampton Coliseum Lunar Pursuit` | Shows | 0-3 | Medium | Venue + song |

### 12. Edge Cases and Variations

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `shimmy` | Shows | 20-100 | High | Case insensitive |
| `LITTLE SHIMMY` | Shows | 15-80 | High | All caps |
| `basis for day` | Shows | 15-80 | Medium | Missing "a" |
| `New York shimmy > basis` | Shows | 0-5 | High | Mixed case segue |
| `12-30-99` | Shows | 1-3 | Medium | Different date separator |
| `wetlands house dog` | Shows | 1-8 | Medium | All lowercase |
| ` Shimmy ` | Shows | 20-100 | Low | Leading/trailing spaces |
| `Shimmy  Basis` | Shows | 5-30 | Low | Multiple spaces |

### 13. Partial Match Tests

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `Shim` | Shows | 20-100 | Medium | Should find Shimmy |
| `Lun` | Shows | 5-25 | Medium | Should find Lunar |
| `Bas` | Shows | 30-150 | Medium | Should find Basis |
| `Wetl` | Shows | 20-80 | Medium | Should find Wetlands |
| `Bost` | Shows | 20-80 | Medium | Should find Boston |

### 14. Negative Test Cases (Should Return Few/No Results)

| Query | Expected Type | Expected Count | Priority | Notes |
|-------|---------------|----------------|----------|-------|
| `XYZ123NonexistentSong` | Shows | 0 | Medium | Should return no results |
| `2050 Shimmy` | Shows | 0 | Medium | Future date |
| `Mars Venue Shimmy` | Shows | 0 | Low | Non-existent venue |
| `Shimmy > NonexistentSong` | Shows | 0 | Medium | Invalid segue |

## Test Data Generation Notes

### Expected Results Calculation
For each test case, the test runner should:

1. **Query the database directly** to find what SHOULD be returned
2. **Execute the search** through the API
3. **Compare results** and flag discrepancies
4. **Calculate success metrics** (precision, recall, ranking quality)

### Database Validation Queries

#### For Date Searches:
```sql
SELECT * FROM shows 
WHERE date = '1999-12-30' -- for exact dates
OR EXTRACT(YEAR FROM date) = 1999 -- for year searches  
OR EXTRACT(MONTH FROM date) = 12 AND EXTRACT(YEAR FROM date) = 1999 -- for month searches
```

#### For Song Searches:
```sql
SELECT DISTINCT s.* FROM shows s
JOIN tracks t ON s.id = t.show_id
JOIN songs so ON t.song_id = so.id
WHERE LOWER(so.title) LIKE '%shimmy%'
OR so.title ILIKE '%Little Shimmy in a Conga Line%'
```

#### For Venue Searches:
```sql
SELECT s.* FROM shows s
JOIN venues v ON s.venue_id = v.id
WHERE LOWER(v.name) LIKE '%wetlands%'
OR LOWER(v.city) LIKE '%boston%'
OR LOWER(v.state) LIKE '%massachusetts%'
```

#### For Segue Searches:
```sql
SELECT DISTINCT s.* FROM shows s
JOIN segue_runs sr ON s.id = sr.show_id
WHERE LOWER(sr.sequence) LIKE '%shimmy%basis%'
```

#### For Combined Searches:
```sql
-- Example: "1999 Boston Shimmy"
SELECT DISTINCT s.* FROM shows s
JOIN venues v ON s.venue_id = v.id
JOIN tracks t ON s.id = t.show_id
JOIN songs so ON t.song_id = so.id
WHERE EXTRACT(YEAR FROM s.date) = 1999
AND (LOWER(v.city) LIKE '%boston%' OR LOWER(v.name) LIKE '%boston%')
AND LOWER(so.title) LIKE '%shimmy%'
```

## Success Metrics

For each test run, track:
- **Total Searches**: Number of queries executed
- **Found Results**: Searches that returned results
- **Correct Results**: Results that match expected database queries
- **Precision**: Percentage of returned results that are correct
- **Recall**: Percentage of expected results that were found
- **Ranking Quality**: Whether most relevant results appear first

## Improvement Tracking

Keep a log of improvements:
- **Date**: When test was run
- **Pass Rate**: Percentage of critical tests passing
- **Failed Cases**: Which searches are still failing
- **Changes Made**: What algorithm tweaks were applied
- **Performance**: Average search response time

This allows systematic improvement of search quality over time.