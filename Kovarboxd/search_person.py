"""
Person search functionality for Kovarboxd.

This module provides functions to search for people (actors, directors, crew)
and retrieve their filmography from the PostgreSQL database.
"""

from typing import Optional
from collections import defaultdict
import pandas as pd
from db import engine
from sqlalchemy import text

# Base URL for TMDb profile images
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Cache whether the current database has profile_path columns in movie_cast and crew
_PROFILE_PATH_SUPPORTED: Optional[bool] = None

def _supports_profile_path() -> bool:
    """Detect if both movie_cast.profile_path and crew.profile_path exist."""
    global _PROFILE_PATH_SUPPORTED
    if _PROFILE_PATH_SUPPORTED is not None:
        return _PROFILE_PATH_SUPPORTED
    try:
        with engine.begin() as conn:
            cnt = conn.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND column_name = 'profile_path'
                      AND table_name IN ('movie_cast', 'crew')
                    """
                )
            ).scalar()
            # Require both tables to have the column
            _PROFILE_PATH_SUPPORTED = (cnt == 2)
    except Exception:
        _PROFILE_PATH_SUPPORTED = False
    return _PROFILE_PATH_SUPPORTED


def search_persons(query: str, page: int = 1, per_page: int = 9) -> tuple[pd.DataFrame, bool]:
    """
    Search for people by name using ILIKE pattern matching.
    
    Args:
        query: Search string to match against person names
        page: Page number (1-indexed)
        per_page: Number of results per page
        
    Returns:
        Tuple of (DataFrame with person results, has_next_page boolean)
        
    DataFrame columns (matching template requirements):
        - nconst: Person ID (int)
        - primaryName: Person's name (str)
        - profile_url: Profile image URL or None
    """
    if not query or not query.strip():
        return pd.DataFrame(), False
    
    sql_limit = per_page + 1
    offset = (page - 1) * per_page
    
    # Slightly more forgiving: 20% of length, min 2, max 3
    threshold = max(2, min(3, int(len(query) * 0.2)))
    
    # Choose SQL based on whether profile_path is available in the schema
    if _supports_profile_path():
        sql = """
            WITH all_people AS (
                SELECT DISTINCT person_id, name, profile_path FROM movie_cast
                WHERE profile_path IS NOT NULL
                UNION
                SELECT DISTINCT person_id, name, profile_path FROM crew
                WHERE profile_path IS NOT NULL
                UNION
                SELECT DISTINCT person_id, name, NULL as profile_path FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name, NULL as profile_path FROM directors
                UNION
                SELECT DISTINCT person_id, name, NULL as profile_path FROM crew
            )
            SELECT 
                person_id AS nconst,
                name AS "primaryName",
                CASE 
                    WHEN profile_path IS NOT NULL AND profile_path <> '' 
                    THEN %(img_base)s || profile_path 
                    ELSE NULL 
                END AS profile_url,
                levenshtein(LOWER(name), LOWER(%(query)s)) as distance
            FROM all_people
            WHERE name ILIKE %(pattern)s
               OR levenshtein(LOWER(name), LOWER(%(query)s)) <= %(threshold)s
            ORDER BY 
                CASE WHEN name ILIKE %(pattern)s THEN 0 ELSE 1 END,
                distance ASC,
                name
            LIMIT %(limit)s OFFSET %(offset)s
        """
        params = {
            "pattern": f"%{query}%",
            "query": query,
            "threshold": threshold,
            "limit": sql_limit,
            "offset": offset,
            "img_base": IMAGE_BASE,
        }
    else:
        sql = """
            WITH all_people AS (
                SELECT DISTINCT person_id, name FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name FROM crew
                UNION
                SELECT DISTINCT person_id, name FROM directors
            )
            SELECT 
                person_id AS nconst,
                name AS "primaryName",
                NULL::text AS profile_url,
                levenshtein(LOWER(name), LOWER(%(query)s)) as distance
            FROM all_people
            WHERE name ILIKE %(pattern)s
               OR levenshtein(LOWER(name), LOWER(%(query)s)) <= %(threshold)s
            ORDER BY 
                CASE WHEN name ILIKE %(pattern)s THEN 0 ELSE 1 END,
                distance ASC,
                name
            LIMIT %(limit)s OFFSET %(offset)s
        """
        params = {
            "pattern": f"%{query}%",
            "query": query,
            "threshold": threshold,
            "limit": sql_limit,
            "offset": offset,
        }
    
    df = pd.read_sql_query(sql, engine, params=params)
    has_next_page = len(df) > per_page
    
    return df.iloc[:per_page].copy(), has_next_page


def get_person_by_id(person_id: int) -> tuple[Optional[dict], list[str], dict[str, list[dict]]]:
    """
    Get person details and their filmography grouped by role category.
    
    Args:
        person_id: The person's ID
        
    Returns:
        Tuple of (person_dict, categories_list, movies_by_category_dict)
        Returns (None, [], {}) if person not found
        
    person_dict keys (matching template requirements):
        - nconst, primaryName, birthYear, deathYear, profile_url
        
    categories_list: List of category names (e.g., ['actor', 'director', 'crew'])
    
    movies_by_category_dict: Dict mapping category -> list of movie dicts
        Each movie dict has: tconst, primaryTitle, startYear, poster_url, 
                            averageRating, numVotes, characters
    """
    # First, get person's name and profile from any of the credit tables
    if _supports_profile_path():
        person_sql = """
            WITH all_people AS (
                SELECT DISTINCT person_id, name, profile_path FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name, profile_path FROM crew
                UNION
                SELECT DISTINCT person_id, name, NULL as profile_path FROM directors
            )
            SELECT 
                person_id AS nconst,
                name AS "primaryName",
                NULL::int AS "birthYear",
                NULL::int AS "deathYear",
                CASE 
                    WHEN profile_path IS NOT NULL AND profile_path <> '' 
                    THEN %(img_base)s || profile_path 
                    ELSE NULL 
                END AS profile_url
            FROM all_people
            WHERE person_id = %(person_id)s
            LIMIT 1
        """
        person_df = pd.read_sql_query(
            person_sql, 
            engine, 
            params={"person_id": person_id, "img_base": IMAGE_BASE}
        )
    else:
        person_sql = """
            WITH all_people AS (
                SELECT DISTINCT person_id, name FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name FROM crew
                UNION
                SELECT DISTINCT person_id, name FROM directors
            )
            SELECT 
                person_id AS nconst,
                name AS "primaryName",
                NULL::int AS "birthYear",
                NULL::int AS "deathYear",
                NULL::text AS profile_url
            FROM all_people
            WHERE person_id = %(person_id)s
            LIMIT 1
        """
        person_df = pd.read_sql_query(
            person_sql, 
            engine, 
            params={"person_id": person_id}
        )
    
    if person_df.empty:
        return None, [], {}
    
    person = person_df.iloc[0].to_dict()
    
    # Get all credits for this person
    credits_sql = """
        WITH all_credits AS (
            -- Acting credits
            SELECT 
                mc.movie_id,
                'actor' AS category,
                mc.character AS role_detail
            FROM movie_cast mc
            WHERE mc.person_id = %(person_id)s
            
            UNION ALL
            
            -- Director credits
            SELECT 
                d.movie_id,
                'director' AS category,
                NULL AS role_detail
            FROM directors d
            WHERE d.person_id = %(person_id)s
            
            UNION ALL
            
            -- Other crew credits
            SELECT 
                cr.movie_id,
                LOWER(COALESCE(NULLIF(cr.department, ''), 'crew')) AS category,
                cr.job AS role_detail
            FROM crew cr
            WHERE cr.person_id = %(person_id)s
        )
        SELECT
            m.movie_id AS tconst,
            m.title AS "primaryTitle",
            EXTRACT(YEAR FROM m.release_date)::int AS "startYear",
            CASE 
                WHEN m.poster_path IS NOT NULL AND m.poster_path <> '' 
                THEN %(img_base)s || m.poster_path 
                ELSE NULL 
            END AS poster_url,
            m.vote_average AS "averageRating",
            m.vote_count AS "numVotes",
            ac.category,
            ac.role_detail AS characters
        FROM all_credits ac
        JOIN movies m ON m.movie_id = ac.movie_id
        ORDER BY COALESCE(m.vote_count, 0) DESC, m.title
    """
    
    credits_df = pd.read_sql_query(
        credits_sql, 
        engine, 
        params={"person_id": person_id, "img_base": IMAGE_BASE}
    )
    
    # Group movies by category, deduplicating within each category
    movies_by_category: dict[str, list[dict]] = defaultdict(list)
    seen_in_category: dict[str, set] = defaultdict(set)
    
    for _, row in credits_df.iterrows():
        category = row["category"]
        tconst = row["tconst"]
        
        # Skip if we've already added this movie in this category
        if tconst in seen_in_category[category]:
            # But we might want to append additional character names
            for movie in movies_by_category[category]:
                if movie["tconst"] == tconst and row["characters"]:
                    existing_chars = movie.get("characters", "") or ""
                    if row["characters"] not in existing_chars:
                        if existing_chars:
                            movie["characters"] = f"{existing_chars}, {row['characters']}"
                        else:
                            movie["characters"] = row["characters"]
            continue
        
        seen_in_category[category].add(tconst)
        
        movies_by_category[category].append({
            "tconst": tconst,
            "primaryTitle": row["primaryTitle"],
            "startYear": row["startYear"],
            "poster_url": row["poster_url"],
            "averageRating": row["averageRating"],
            "numVotes": row["numVotes"],
            "characters": row["characters"] or "",
        })
    
    # Sort categories with a preferred order (actor, director first)
    category_order = {"actor": 0, "director": 1}
    categories = sorted(
        movies_by_category.keys(),
        key=lambda c: (category_order.get(c, 99), c)
    )
    
    return person, categories, dict(movies_by_category)


def get_person_candidates(query: str, limit: int = 5) -> list[dict]:
    """
    Get top person matches for a query (for multi-person search confirmation).
    
    Args:
        query: Search string
        limit: Maximum number of candidates to return
        
    Returns:
        List of person dicts with: nconst, primaryName, profile_url
    """
    if not query or not query.strip():
        return []
    
    # Slightly more forgiving: 20% of length, clamped to [2, 3]
    threshold = max(2, min(3, int(len(query) * 0.2)))

    if _supports_profile_path():
        sql = """
            WITH all_people AS (
                -- Prefer sources with profile_path
                SELECT DISTINCT person_id, name, profile_path FROM movie_cast WHERE profile_path IS NOT NULL
                UNION
                SELECT DISTINCT person_id, name, profile_path FROM crew WHERE profile_path IS NOT NULL
                UNION
                -- Fallbacks without profile_path
                SELECT DISTINCT person_id, name, NULL AS profile_path FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name, NULL AS profile_path FROM directors
                UNION
                SELECT DISTINCT person_id, name, NULL AS profile_path FROM crew
            ),
            ranked AS (
                SELECT 
                    person_id AS nconst,
                    name AS "primaryName",
                    CASE 
                        WHEN profile_path IS NOT NULL AND profile_path <> '' 
                        THEN %(img_base)s || profile_path 
                        ELSE NULL 
                    END AS profile_url,
                    -- Exact match gets priority
                    CASE WHEN LOWER(name) = LOWER(%(exact)s) THEN 0 ELSE 1 END AS rank_order,
                    levenshtein(LOWER(name), LOWER(%(query)s)) AS distance
                FROM all_people
                WHERE name ILIKE %(pattern)s
                   OR levenshtein(LOWER(name), LOWER(%(query)s)) <= %(threshold)s
            )
            SELECT nconst, "primaryName", profile_url
            FROM ranked
            ORDER BY rank_order, distance ASC, "primaryName"
            LIMIT %(limit)s
        """
        params = {
            "exact": query.strip(),
            "pattern": f"%{query}%",
            "query": query,
            "threshold": threshold,
            "limit": limit,
            "img_base": IMAGE_BASE,
        }
    else:
        sql = """
            WITH all_people AS (
                SELECT DISTINCT person_id, name FROM movie_cast
                UNION
                SELECT DISTINCT person_id, name FROM directors
                UNION
                SELECT DISTINCT person_id, name FROM crew
            ),
            ranked AS (
                SELECT 
                    person_id AS nconst,
                    name AS "primaryName",
                    NULL::text AS profile_url,
                    -- Exact match gets priority
                    CASE WHEN LOWER(name) = LOWER(%(exact)s) THEN 0 ELSE 1 END AS rank_order,
                    levenshtein(LOWER(name), LOWER(%(query)s)) AS distance
                FROM all_people
                WHERE name ILIKE %(pattern)s
                   OR levenshtein(LOWER(name), LOWER(%(query)s)) <= %(threshold)s
            )
            SELECT nconst, "primaryName", profile_url
            FROM ranked
            ORDER BY rank_order, distance ASC, "primaryName"
            LIMIT %(limit)s
        """
        params = {
            "exact": query.strip(),
            "pattern": f"%{query}%",
            "query": query,
            "threshold": threshold,
            "limit": limit,
        }
    
    df = pd.read_sql_query(sql, engine, params=params)
    return df.to_dict(orient="records")


# Convenience aliases for backwards compatibility
def search_person(query: str):
    """Search for a single person and return their details."""
    results, _ = search_persons(query, page=1, per_page=1)
    if results.empty:
        return None, None
    
    person_id = int(results.iloc[0]["nconst"])
    return get_person_by_id(person_id)


def get_person_by_nconst(nconst: str):
    """Alias for get_person_by_id with string input."""
    return get_person_by_id(int(nconst))
