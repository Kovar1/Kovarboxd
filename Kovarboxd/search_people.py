"""
Multi-person search functionality for Kovarboxd.

This module provides functions to find films featuring multiple people,
with candidate confirmation flow for ambiguous name matches.
"""

from typing import Optional
import pandas as pd
from db import engine
from search_person import get_person_candidates

# Base URL for TMDb poster images
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"


def get_candidates_for_names(names: list[str], candidates_per_name: int = 5) -> list[dict]:
    """
    Get candidate matches for a list of input names.
    
    Args:
        names: List of name strings to search for
        candidates_per_name: Max candidates to return per name
        
    Returns:
        List of candidate_list dicts for people_confirm.html template:
        [
            {
                "original_position": 1,
                "input": "tom cruise",
                "candidates": [
                    {"nconst": 123, "primaryName": "Tom Cruise", "profile_url": None},
                    ...
                ]
            },
            ...
        ]
    """
    candidate_lists = []
    
    for i, name in enumerate(names, start=1):
        name = name.strip() if name else ""
        if not name:
            continue
            
        candidates = get_person_candidates(name, limit=candidates_per_name)
        
        candidate_lists.append({
            "original_position": i,
            "input": name,
            "candidates": candidates,
        })
    
    return candidate_lists


def search_films_by_person_ids(person_ids: list[int]) -> pd.DataFrame:
    """
    Find films that feature ALL of the given people.
    
    Args:
        person_ids: List of person IDs that must all appear in the film
        
    Returns:
        DataFrame with films matching template requirements:
        - tconst: Movie ID
        - primaryTitle: Movie title
        - startYear: Release year
        - poster_url: Poster image URL
        - persons: Comma-separated names of matched people
    """
    if not person_ids:
        return pd.DataFrame(columns=["tconst", "primaryTitle", "startYear", "poster_url", "persons"])
    
    sql = """
        WITH all_credits AS (
            -- All credits from all tables
            SELECT movie_id, person_id, name FROM movie_cast
            UNION ALL
            SELECT movie_id, person_id, name FROM directors
            UNION ALL
            SELECT movie_id, person_id, name FROM crew
        ),
        -- Find movies that have ALL requested people
        matching_movies AS (
            SELECT movie_id
            FROM all_credits
            WHERE person_id = ANY(%(person_ids)s)
            GROUP BY movie_id
            HAVING COUNT(DISTINCT person_id) = %(person_count)s
        ),
        -- Get distinct person names for aggregation
        person_names AS (
            SELECT DISTINCT person_id, name
            FROM all_credits
            WHERE person_id = ANY(%(person_ids)s)
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
            STRING_AGG(DISTINCT pn.name, ', ' ORDER BY pn.name) AS persons
        FROM matching_movies mm
        JOIN movies m ON m.movie_id = mm.movie_id
        JOIN all_credits ac ON ac.movie_id = mm.movie_id AND ac.person_id = ANY(%(person_ids)s)
        JOIN person_names pn ON pn.person_id = ac.person_id
        GROUP BY m.movie_id, m.title, m.release_date, m.poster_path
        ORDER BY m.release_date DESC NULLS LAST, m.title
    """
    
    params = {
        "person_ids": person_ids,
        "person_count": len(person_ids),
        "img_base": IMAGE_BASE,
    }
    
    return pd.read_sql_query(sql, engine, params=params)


def get_person_name_by_id(person_id: int) -> Optional[str]:
    """Get a person's name by their ID."""
    sql = """
        WITH all_people AS (
            SELECT DISTINCT person_id, name FROM movie_cast
            UNION
            SELECT DISTINCT person_id, name FROM directors
            UNION
            SELECT DISTINCT person_id, name FROM crew
        )
        SELECT name FROM all_people WHERE person_id = %(person_id)s LIMIT 1
    """
    
    result = pd.read_sql_query(sql, engine, params={"person_id": person_id})
    return result.iloc[0]["name"] if not result.empty else None


def build_matched_people_list(
    input_names: list[tuple[int, str]], 
    selected_nconsts: list[tuple[int, Optional[int]]]
) -> list[tuple[str, Optional[int], Optional[str]]]:
    """
    Build the matched_people list for the results template.
    
    Args:
        input_names: List of (position, input_name) tuples
        selected_nconsts: List of (position, nconst_or_none) tuples
        
    Returns:
        List of (input_name, nconst, matched_name) tuples for template
    """
    # Create lookup dicts
    names_by_pos = {pos: name for pos, name in input_names}
    nconsts_by_pos = {pos: nconst for pos, nconst in selected_nconsts}
    
    result = []
    for pos in sorted(names_by_pos.keys()):
        input_name = names_by_pos[pos]
        nconst = nconsts_by_pos.get(pos)
        
        if nconst:
            matched_name = get_person_name_by_id(nconst)
        else:
            matched_name = None
            
        result.append((input_name, nconst, matched_name))
    
    return result


# =============================================================================
# High-level convenience functions
# =============================================================================

def search_people_by_nconsts(nconsts: list[str]) -> pd.DataFrame:
    """
    Convenience function to search by string nconsts.
    
    Args:
        nconsts: List of person ID strings
        
    Returns:
        DataFrame of matching films
    """
    person_ids = [int(n) for n in nconsts if n]
    return search_films_by_person_ids(person_ids)
