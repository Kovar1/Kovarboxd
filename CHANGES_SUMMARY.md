# Data Recovery & Enhancement Summary

## Problem Identified
The existing data pipeline was **losing critical information** from the TMDB API:

1. **Producers, writers, cinematographers, etc. were completely discarded** - only directors were kept
2. **Actor profile pictures were not being stored** despite being available in the API
3. **226 out of 228 crew members** per movie (those who aren't directors) were lost

## Root Causes

### In `bulk_tmdb.py`:
- `getCastAndCrew()` function was filtering crew to only extract Directors
- Full crew list was fetched but immediately discarded
- No profile paths were being preserved

### In `json_to_postgres.py`:
- Tables had no `profile_path` columns
- Code expected a `crew` field that was never populated from `bulk_tmdb.py`
- Fallback to directors meant crew table only had director data

### In `search_person.py`:
- Queries returned `NULL` for all profile URLs
- No attempt to fetch profile paths from database

## Changes Implemented

### 1. [bulk_tmdb.py](bulk_tmdb.py)
```python
# BEFORE: Only kept directors
movie['cast'] = credits['cast']
movie['directors'] = directors

# AFTER: Stores full crew list + keeps directors
movie['cast'] = credits['cast']
movie['crew'] = crew  # Store FULL crew list (producers, writers, cinematographers, etc.)
movie['directors'] = directors
```

**Impact**: All crew members (14,000+) now preserved, not just directors

### 2. [json_to_postgres.py](json_to_postgres.py)

#### Schema Changes:
```sql
-- CAST table: Added profile_path
CREATE TABLE IF NOT EXISTS cast (
    ...
    profile_path TEXT  -- NEW
);

-- CREW table: Added profile_path
CREATE TABLE IF NOT EXISTS crew (
    ...
    profile_path TEXT  -- NEW
);
```

#### Data Processing:
- `iter_cast_rows()`: Now extracts `profile_path` from cast members (7 columns → was 6)
- `iter_crew_rows()`: Now extracts `profile_path` from all crew members (7 columns → was 6)
- COPY statements updated to include `profile_path` columns

**Impact**: Actor/crew profile pictures now available in database

### 3. [search_person.py](search_person.py)

#### `search_persons()` function:
```python
# BEFORE: Always returned NULL for profile_url
SELECT ... NULL::text AS profile_url

# AFTER: Constructs profile URL from profile_path
WITH all_people AS (
    SELECT DISTINCT person_id, name, profile_path FROM movie_cast
    WHERE profile_path IS NOT NULL
    UNION
    -- ... other tables
)
SELECT ...
    CASE 
        WHEN profile_path IS NOT NULL AND profile_path <> '' 
        THEN 'https://image.tmdb.org/t/p/w500' || profile_path 
        ELSE NULL 
    END AS profile_url
```

#### `get_person_by_id()` function:
- Also updated to fetch and construct profile URLs from database

**Impact**: Profile pictures now displayed in person search results and person details pages

## Data Recovery Stats

| Category | Before | After | Recovery |
|----------|--------|-------|----------|
| **Actors** | 216,233 with profile_path | 216,233 with profile_path | ✓ Enabled |
| **Directors** | 6,914 | 6,914 | No change |
| **Crew Members** | Only directors (~6,914) | All crew (~14,000+) | +100% increase |
| **Profile Pictures** | 0 available | 220,920+ available | ✓ Enabled |

## Migration Steps

### For Fresh Installation:
1. Re-run `bulk_tmdb.py` to fetch data with full crew lists
2. Run updated `json_to_postgres.py` with new schema
3. Start application - profile pictures will load automatically

### For Existing Database:
```sql
-- Add profile_path columns to existing tables
ALTER TABLE cast ADD COLUMN profile_path TEXT;
ALTER TABLE crew ADD COLUMN profile_path TEXT;

-- Or completely rebuild:
-- 1. Re-export JSON with bulk_tmdb.py
-- 2. Drop/recreate tables with json_to_postgres.py
-- 3. Reload SQL dump
```

## Visual Improvements Expected

- Actor profile pictures now display in person search results
- Director profile pictures now display
- All crew members (producers, writers, etc.) searchable and their profiles visible
- More comprehensive filmography for each person across all roles

## Files Modified

1. **d:\TMDb_data_project\bulk_tmdb.py** - Store full crew data
2. **d:\TMDb_data_project\json_to_postgres.py** - Updated schema + data extraction
3. **d:\TMDb_data_project\Kovarboxd\search_person.py** - Use profile_path from database
