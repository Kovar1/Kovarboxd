import pandas as pd
import time
from db import conn
from tmdb import get_cached_poster
from tmdb import get_cached_actor_image
import unicodedata


# ---------------------------------------------------------
# SEARCH BY NAME (fallback search)
# ---------------------------------------------------------
def search_person(query: str):
    """Returns person_df and movies_df for a name-based search."""
    print(f"[SEARCH_PERSON] query={query!r}")

    # Check if FTS5 table exists
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='name_basics_fts';")
    has_fts5 = cur.fetchone() is not None

    if has_fts5:
        # Use FTS5 for fast accent-insensitive search
        person_df = pd.read_sql_query("""
            SELECT nconst, primaryName
            FROM name_basics_fts
            WHERE name_basics_fts MATCH ?
            ORDER BY rank
            LIMIT 1;
        """, conn, params=[query + '*'])
    else:
        # Fallback to LIKE query if FTS5 not set up
        person_df = pd.read_sql_query("""
            SELECT nconst, primaryName
            FROM name_basics
            WHERE primaryName LIKE '%' || ? || '%'
            ORDER BY primaryName
            LIMIT 1;
        """, conn, params=[query])

    if person_df.empty:
        print(f"[SEARCH_PERSON] no match for {query!r}")
        return None, None

    nconst = person_df.iloc[0]["nconst"]
    print(f"[SEARCH_PERSON] matched nconst={nconst}")
    return get_person_by_nconst(nconst)


# ---------------------------------------------------------
# EXACT LOOKUP BY NCONST
# ---------------------------------------------------------
def get_person_by_nconst(nconst: str):
    """Returns person_df and movies_df given a known nconst (exact lookup)."""

    print(f"[GET_PERSON] nconst={nconst}")

    # Fetch person info
    person_df = pd.read_sql_query("""
        SELECT n.nconst, n.primaryName, n.birthYear, n.deathYear, a.profile_path AS profile_url
        FROM name_basics n
        LEFT JOIN tmdb_actor_images a ON n.nconst = a.nconst
        WHERE n.nconst = ?;
    """, conn, params=[nconst])

    if person_df.empty:
        print(f"[GET_PERSON] no person found for nconst={nconst}")
        return None, None

    # Fetch that person's movies — ordered by rating * vote count, with role category
    movies_df = pd.read_sql_query("""
        SELECT 
            b.tconst,
            b.primaryTitle,
            b.startYear,
            r.averageRating,
            r.numVotes,
            tp.poster_url,
            p.category,
            p.characters
        FROM title_principals p
        JOIN title_basics b ON p.tconst = b.tconst
        LEFT JOIN title_ratings r ON b.tconst = r.tconst
        LEFT JOIN tmdb_posters tp ON b.tconst = tp.tconst
        WHERE p.nconst = ?
          AND b.titleType = 'movie'
        ORDER BY 
            (COALESCE(r.averageRating, 0) * COALESCE(r.numVotes, 0)) DESC,
            p.category;
    """, conn, params=[nconst])

    print(f"[GET_PERSON] fetched {len(movies_df)} movies for nconst={nconst}")

    # Deduplicate movies and concatenate characters for same movie+category
    deduped_movies = {}
    for _, row in movies_df.iterrows():
        key = (row['tconst'], row['category'])
        if key not in deduped_movies:
            deduped_movies[key] = {
                'tconst': row['tconst'],
                'primaryTitle': row['primaryTitle'],
                'startYear': row['startYear'],
                'averageRating': row['averageRating'],
                'numVotes': row['numVotes'],
                'poster_url': row['poster_url'],
                'category': row['category'],
                'characters': []
            }
        if row['characters'] and row['characters'] not in ['[]', '']:
            # Clean up JSON format: remove [""], decode if needed
            char_str = str(row['characters'])
            char_str = char_str.replace('["', '').replace('"]', '').replace('"', '')
            if char_str and char_str not in ['[]', '']:
                deduped_movies[key]['characters'].append(char_str)
    
    # Convert back to list and combine character names
    movies_list = []
    for movie_data in deduped_movies.values():
        # Concatenate character names with commas
        char_str = ', '.join(movie_data['characters']) if movie_data['characters'] else ''
        movie_data['characters'] = char_str
        movies_list.append(movie_data)
    
    movies_df = pd.DataFrame(movies_list)

    # poster_url and profile_url are loaded from cache via LEFT JOIN above

    return person_df, movies_df


def remove_accents(text: str) -> str:
    """Remove accent marks from text for accent-insensitive search."""
    if not text:
        return text
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

# ---------------------------------------------------------
# SEARCH PERSONS BY NAME (returns multiple matches, like movie search)
# ---------------------------------------------------------
def search_persons(query: str, page: int = 1):
    """Returns up to 10 people + boolean has_next_page."""

    per_page = 9
    sql_limit = per_page + 1
    offset = (page - 1) * per_page

    # Check if FTS5 table exists
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='name_basics_fts';")
    has_fts5 = cur.fetchone() is not None

    if has_fts5:
        # -------------------------
        # FTS5 SEARCH (fast, accent-insensitive, ranked)
        # -------------------------
        start = time.time()
        # Use prefix match with wildcard for substring matching
        # FTS5 tokenizer handles accent removal automatically
        fts_df = pd.read_sql_query("""
            SELECT f.nconst, f.primaryName, a.profile_path AS profile_url
            FROM name_basics_fts f
            LEFT JOIN tmdb_actor_images a ON f.nconst = a.nconst
            WHERE name_basics_fts MATCH ?
            ORDER BY (a.profile_path IS NOT NULL) DESC, rank
            LIMIT ? OFFSET ?;
        """, conn, params=[query + '*', sql_limit, offset])
        print(f"[FTS5 search] {time.time() - start:.3f}s")

        has_next_page = len(fts_df) == sql_limit
        results_df = fts_df.iloc[:per_page].copy()
        return results_df, has_next_page

    # -------------------------
    # FALLBACK: Check for normalized column (legacy support)
    # -------------------------
    cur.execute("PRAGMA table_info(name_basics);")
    cols = [r[1] for r in cur.fetchall()]
    use_norm = 'primaryName_norm' in cols

    if use_norm:
        normalized_query = remove_accents(query).lower()
        # Try prefix search using the indexed normalized column (fast)
        start = time.time()
        pref_param = normalized_query + '%'
        candidates_df = pd.read_sql_query(
            """
            SELECT n.nconst, n.primaryName, n.primaryName_norm, a.profile_path AS profile_url
            FROM name_basics n
            LEFT JOIN tmdb_actor_images a ON n.nconst = a.nconst
            WHERE n.primaryName_norm LIKE ?
            ORDER BY (a.profile_path IS NOT NULL) DESC, n.primaryName_norm
            LIMIT 250;
            """, conn, params=[pref_param]
        )
        print(f"[SQL prefixed normalized match] {time.time() - start:.3f}s  (use_norm=True)")

        if not candidates_df.empty:
            has_next_page = len(candidates_df) > per_page
            results_df = candidates_df.iloc[:per_page].copy()
            return results_df, has_next_page

        # Fallback fuzzy on normalized column
        start = time.time()
        fuzzy_param = '%' + normalized_query + '%'
        fuzzy_df = pd.read_sql_query(
            """
            SELECT n.nconst, n.primaryName, n.primaryName_norm, a.profile_path AS profile_url
            FROM name_basics n
            LEFT JOIN tmdb_actor_images a ON n.nconst = a.nconst
            WHERE n.primaryName_norm LIKE ?
            ORDER BY (a.profile_path IS NOT NULL) DESC, n.primaryName_norm
            LIMIT 500;
            """, conn, params=[fuzzy_param]
        )
        print(f"[SQL fuzzy normalized match] {time.time() - start:.3f}s  (use_norm=True)")

        has_next_page = len(fuzzy_df) > per_page
        results_df = fuzzy_df.iloc[:per_page].copy()
        return results_df, has_next_page

    # -------------------------
    # FALLBACK: EXACT MATCH QUERY (original behavior)
    # -------------------------
    start = time.time()
    exact_df = pd.read_sql_query("""
        SELECT n.nconst, n.primaryName, a.profile_path AS profile_url
        FROM name_basics n
        LEFT JOIN tmdb_actor_images a ON n.nconst = a.nconst
        WHERE n.primaryName = ?
        ORDER BY n.primaryName
        LIMIT ? OFFSET ?;
    """, conn, params=[query, sql_limit, offset])
    print(f"[SQL exact match person] {time.time() - start:.3f}s")

    if not exact_df.empty:
        has_next_page = len(exact_df) == sql_limit
        results_df = exact_df.iloc[:per_page].copy()
        return results_df, has_next_page

    # -------------------------
    # FALLBACK: FUZZY MATCH QUERY (original behavior)
    # -------------------------
    start = time.time()
    fuzzy_df = pd.read_sql_query("""
        SELECT n.nconst, n.primaryName, a.profile_path AS profile_url
        FROM name_basics n
        LEFT JOIN tmdb_actor_images a ON n.nconst = a.nconst
        WHERE n.primaryName LIKE '%' || ? || '%'
        ORDER BY n.primaryName
        LIMIT ? OFFSET ?;
    """, conn, params=[query, sql_limit, offset])
    print(f"[SQL fuzzy match person] {time.time() - start:.3f}s")

    has_next_page = len(fuzzy_df) == sql_limit
    results_df = fuzzy_df.iloc[:per_page].copy()
    return results_df, has_next_page
