import pandas as pd
import time
from db import conn


def search_movies(query: str, page: int = 1):
    """Returns up to `per_page` movies + boolean has_next_page.

    Pagination: show `per_page` results per page. We fetch `per_page + 1`
    rows from the DB to detect whether a next page exists.
    """
    print(f"[SEARCH_MOVIES] query={query!r} page={page}")
    per_page = 9
    sql_limit = per_page + 1  # fetch one extra row to detect next page
    offset = (page - 1) * per_page

    # Check if FTS5 table exists
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='title_basics_fts';")
    has_fts5 = cursor.fetchone() is not None

    if has_fts5:
        # -------------------------
        # FTS5 SEARCH (fast, ranked by relevance)
        # -------------------------
        start = time.time()
        # Try exact match first using FTS5
        fts_exact_df = pd.read_sql_query("""
            SELECT f.tconst, f.primaryTitle, f.startYear, p.poster_url
            FROM title_basics_fts f
            LEFT JOIN tmdb_posters p ON f.tconst = p.tconst
            WHERE title_basics_fts MATCH ?
            ORDER BY f.startYear
            LIMIT ? OFFSET ?;
        """, conn, params=['"' + query + '"', sql_limit, offset])
        print(f"[FTS5 exact match] {time.time() - start:.3f}s")

        if not fts_exact_df.empty:
            has_next_page = len(fts_exact_df) == sql_limit
            return fts_exact_df.iloc[:per_page], has_next_page

        # Fuzzy match using FTS5 with ranking and popularity
        start = time.time()
        fts_fuzzy_df = pd.read_sql_query("""
            SELECT f.tconst, f.primaryTitle, f.startYear, r.numVotes, tp.poster_url
            FROM title_basics_fts f
            LEFT JOIN title_ratings r ON f.tconst = r.tconst
            LEFT JOIN tmdb_posters tp ON f.tconst = tp.tconst
            WHERE title_basics_fts MATCH ?
            ORDER BY rank, r.numVotes IS NULL, r.numVotes DESC
            LIMIT ? OFFSET ?;
        """, conn, params=[query + '*', sql_limit, offset])
        print(f"[FTS5 fuzzy match] {time.time() - start:.3f}s")
        has_next_page = len(fts_fuzzy_df) == sql_limit
        return fts_fuzzy_df.iloc[:per_page], has_next_page

    # -------------------------
    # FALLBACK: EXACT MATCH QUERY (original behavior)
    # -------------------------
    start = time.time()
    exact_df = pd.read_sql_query("""
                SELECT b.tconst, b.primaryTitle, b.startYear, p.poster_url
                FROM title_basics b
                LEFT JOIN tmdb_posters p ON b.tconst = p.tconst
                WHERE b.primaryTitle = ?
                    AND b.titleType = 'movie'
                ORDER BY b.startYear
                LIMIT ? OFFSET ?;
    """, conn, params=[query, sql_limit, offset])
    print(f"[SQL exact match] {time.time() - start:.3f}s")

    if not exact_df.empty:
        has_next_page = len(exact_df) == sql_limit
        return exact_df.iloc[:per_page], has_next_page

    # -------------------------
    # FALLBACK: FUZZY MATCH QUERY (original behavior)
    # -------------------------
    start = time.time()
    fuzzy_df = pd.read_sql_query("""
        SELECT b.tconst, b.primaryTitle, b.startYear, r.numVotes, tp.poster_url
        FROM title_basics b
        LEFT JOIN title_ratings r ON b.tconst = r.tconst
        LEFT JOIN tmdb_posters tp ON b.tconst = tp.tconst
        WHERE b.primaryTitle LIKE '%' || ? || '%'
          AND b.titleType = 'movie'
        -- SQLite doesn't support NULLS LAST syntax; order NULLs after values
        ORDER BY r.numVotes IS NULL, r.numVotes DESC
        LIMIT ? OFFSET ?;
    """, conn, params=[query, sql_limit, offset])
    print(f"[SQL fuzzy match] {time.time() - start:.3f}s")
    has_next_page = len(fuzzy_df) == sql_limit
    return fuzzy_df.iloc[:per_page], has_next_page


def get_movie_details(tconst: str):
    """Returns selected movie row, actors, and crew."""

    # Movie row
    start = time.time()
    selected_df = pd.read_sql_query("""
        SELECT b.tconst, b.primaryTitle, b.startYear, p.poster_url
        FROM title_basics b
        LEFT JOIN tmdb_posters p ON b.tconst = p.tconst
        WHERE b.tconst = ?;
    """, conn, params=[tconst])
    print(f"[SQL movie row] {time.time() - start:.3f}s")

    # Actors
    start = time.time()
    actors_df = pd.read_sql_query("""
        SELECT 
            n.nconst,
            n.primaryName AS actorName,
            p.characters
        FROM title_principals p
        JOIN name_basics n ON p.nconst = n.nconst
        WHERE p.tconst = ?
          AND p.category IN ('actor', 'actress')
        ORDER BY p.ordering ASC;
    """, conn, params=[tconst])
    print(f"[SQL actors] {time.time() - start:.3f}s")

    # Clean character names (remove JSON formatting)
    if not actors_df.empty:
        actors_df['characters'] = actors_df['characters'].apply(
            lambda x: str(x).replace('["', '').replace('"]', '').replace('"', '') if x else ''
        )

    # Crew
    start = time.time()
    crew_df = pd.read_sql_query("""
        SELECT
            n.nconst,
            n.primaryName AS crewName,
            p.category AS role,
            p.job AS jobDescription
        FROM title_principals p
        JOIN name_basics n ON p.nconst = n.nconst
        WHERE p.tconst = ?
          AND p.category NOT IN ('actor', 'actress')
        ORDER BY p.category, p.ordering ASC;
    """, conn, params=[tconst])
    print(f"[SQL crew] {time.time() - start:.3f}s")

    return selected_df, actors_df, crew_df
