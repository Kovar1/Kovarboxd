"""
Movie search functionality for Kovarboxd.

This module provides functions to search movies and retrieve movie details
from the PostgreSQL database. Results are formatted to match template requirements.
"""

from typing import Optional
import pandas as pd
from db import engine

# Base URL for TMDb poster images
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def search_movies(query: str, page: int = 1, per_page: int = 9) -> tuple[pd.DataFrame, bool]:
    """
    Search movies by title using ILIKE pattern matching.
    
    Args:
        query: Search string to match against movie titles
        page: Page number (1-indexed)
        per_page: Number of results per page
        
    Returns:
        Tuple of (DataFrame with movie results, has_next_page boolean)
        
    DataFrame columns (matching template requirements):
        - tconst: Movie ID (int)
        - primaryTitle: Movie title (str)
        - startYear: Release year (int or None)
        - poster_url: Full TMDb poster URL or None
        - vote_average: Rating (float or None)
        - vote_count: Number of votes (int or None)
    """
    if not query or not query.strip():
        return pd.DataFrame(), False
    
    # Fetch one extra row to determine if there's a next page
    sql_limit = per_page + 1
    offset = (page - 1) * per_page
    
    # Slightly more forgiving: 20% of length, min 2, max 3
    threshold = max(2, min(3, int(len(query) * 0.2)))
    
    sql = """
        SELECT
            m.movie_id AS tconst,
            m.title AS "primaryTitle",
            EXTRACT(YEAR FROM m.release_date)::int AS "startYear",
            CASE 
                WHEN m.poster_path IS NOT NULL AND m.poster_path <> '' 
                THEN %(img_base)s || m.poster_path 
                ELSE NULL 
            END AS poster_url,
            m.vote_average,
            m.vote_count,
            levenshtein(LOWER(m.title), LOWER(%(query)s)) as distance
        FROM movies m
        WHERE m.title ILIKE %(pattern)s
           OR levenshtein(LOWER(m.title), LOWER(%(query)s)) <= %(threshold)s
        ORDER BY 
            CASE WHEN m.title ILIKE %(pattern)s THEN 0 ELSE 1 END,
            distance ASC,
            COALESCE(m.vote_count, 0) DESC,
            m.title
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
    
    df = pd.read_sql_query(sql, engine, params=params)
    has_next_page = len(df) > per_page
    
    return df.iloc[:per_page].copy(), has_next_page


def get_movie_details(movie_id: int) -> tuple[Optional[dict], list[dict], list[dict]]:
    """
    Get full movie details including cast and crew.
    
    Args:
        movie_id: The movie's ID
        
    Returns:
        Tuple of (movie_dict, actors_list, crew_list) or (None, [], []) if not found
        
    movie_dict keys (matching template requirements):
        - tconst, primaryTitle, startYear, poster_url, overview
        
    actors_list item keys:
        - nconst, actorName, characters, profile_url
        
    crew_list item keys:
        - nconst, crewName, role, profile_url
    """
    # Fetch movie details
    movie_sql = """
        SELECT
            m.movie_id AS tconst,
            m.title AS "primaryTitle",
            EXTRACT(YEAR FROM m.release_date)::int AS "startYear",
            CASE 
                WHEN m.poster_path IS NOT NULL AND m.poster_path <> '' 
                THEN %(img_base)s || m.poster_path 
                ELSE NULL 
            END AS poster_url,
            m.overview
        FROM movies m
        WHERE m.movie_id = %(movie_id)s
    """
    
    movie_df = pd.read_sql_query(
        movie_sql, 
        engine, 
        params={"movie_id": movie_id, "img_base": IMAGE_BASE}
    )
    
    if movie_df.empty:
        return None, [], []
    
    movie = movie_df.iloc[0].to_dict()
    
    # Fetch cast (actors)
    actors_sql = """
        SELECT
            c.person_id AS nconst,
            c.name AS "actorName",
            c.character AS characters,
            CASE 
                WHEN c.profile_path IS NOT NULL AND c.profile_path <> '' 
                THEN %(img_base)s || c.profile_path 
                ELSE NULL 
            END AS profile_url
        FROM movie_cast c
        WHERE c.movie_id = %(movie_id)s
        ORDER BY c.order_in_cast NULLS LAST, c.name
    """
    
    actors_df = pd.read_sql_query(
        actors_sql, 
        engine, 
        params={"movie_id": movie_id, "img_base": IMAGE_BASE}
    )
    actors = actors_df.to_dict(orient="records")
    
    # Fetch crew (directors + other crew)
    crew_sql = """
        WITH all_crew AS (
            -- Directors first
            SELECT 
                d.person_id,
                d.name,
                'Director' AS role,
                NULL::text AS profile_path,
                0 AS sort_order
            FROM directors d
            WHERE d.movie_id = %(movie_id)s
            
            UNION ALL
            
            -- Other crew
            SELECT 
                cr.person_id,
                cr.name,
                COALESCE(cr.job, cr.department, 'Crew') AS role,
                cr.profile_path,
                1 AS sort_order
            FROM crew cr
            WHERE cr.movie_id = %(movie_id)s
        ),
        deduped AS (
            SELECT DISTINCT ON (person_id, role)
                person_id,
                name,
                role,
                profile_path,
                sort_order
            FROM all_crew
            ORDER BY person_id, role, sort_order
        )
        SELECT
            person_id AS nconst,
            name AS "crewName",
            role,
            CASE 
                WHEN profile_path IS NOT NULL AND profile_path <> '' 
                THEN %(img_base)s || profile_path 
                ELSE NULL 
            END AS profile_url
        FROM deduped
        ORDER BY sort_order, role, "crewName"
    """
    
    crew_df = pd.read_sql_query(
        crew_sql, 
        engine, 
        params={"movie_id": movie_id, "img_base": IMAGE_BASE}
    )
    crew = crew_df.to_dict(orient="records")
    
    return movie, actors, crew


# =============================================================================
# Future expansion hooks
# =============================================================================

def search_movies_advanced(
    query: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    min_rating: Optional[float] = None,
    genre: Optional[str] = None,
    page: int = 1,
    per_page: int = 9
) -> tuple[pd.DataFrame, bool]:
    """
    Advanced movie search with multiple filters.
    
    This is a placeholder for future expansion. Currently only uses title search.
    """
    # For now, delegate to simple search
    # TODO: Implement advanced filtering
    return search_movies(query or "", page=page, per_page=per_page)
