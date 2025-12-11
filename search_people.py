import pandas as pd
from db import conn
import time
from search_person import search_persons


def _find_best_nconst(name: str):
    """Return (nconst, primaryName) for the best matching person or (None, None)."""
    if not name:
        return None, None
    # Prefer using existing `search_persons` logic (handles normalized column)
    try:
        results_df, _ = search_persons(name, page=1)
        if not results_df.empty:
            row = results_df.iloc[0]
            return row["nconst"], row["primaryName"]
    except Exception:
        # fallback to direct SQL if search_persons is not available for any reason
        pass

    df = pd.read_sql_query(
        """
        SELECT nconst, primaryName
        FROM name_basics
        WHERE primaryName LIKE '%' || ? || '%'
        ORDER BY primaryName
        LIMIT 1;
        """,
        conn,
        params=[name]
    )
    if df.empty:
        return None, None
    return df.iloc[0]["nconst"], df.iloc[0]["primaryName"]


def search_people_by_nconsts(nconsts: list[str]):
        """Return films DataFrame for the provided list of nconsts (intersection).

        nconsts must be a non-empty list of nconst strings.
        """
        placeholders = ','.join('?' for _ in nconsts)
        sql = f"""
        SELECT b.tconst,
                     b.primaryTitle,
                     b.startYear,
                     tp.poster_url,
                     GROUP_CONCAT(DISTINCT n.primaryName) AS persons
        FROM title_principals p
        JOIN title_basics b ON p.tconst = b.tconst
        JOIN name_basics n ON p.nconst = n.nconst
        LEFT JOIN tmdb_posters tp ON b.tconst = tp.tconst
        WHERE b.titleType = 'movie'
            AND p.nconst IN ({placeholders})
        GROUP BY b.tconst
        HAVING COUNT(DISTINCT p.nconst) = ?
        ORDER BY b.startYear DESC, b.primaryTitle;
        """

        params = list(nconsts) + [len(nconsts)]
        films_df = pd.read_sql_query(sql, conn, params=params)
        return films_df


def search_people(names: list[str]):
    """Given up to 3 names (strings), return a dataframe of movies they appear in.

    Returns (films_df, matched_people) where matched_people is a list of tuples
    (input_name, matched_nconst, matched_primaryName).
    """
    # normalize and filter empty inputs
    input_names = [n.strip() for n in names if n and n.strip()]
    matched = []  # tuples (input_name, nconst, matched_name)

    for n in input_names[:3]:
        nconst, matched_name = _find_best_nconst(n)
        matched.append((n, nconst, matched_name))

    # collect nconsts that were found
    nconsts = [m[1] for m in matched if m[1]]

    if not nconsts:
        # no matches — return empty dataframe and matched list
        empty_df = pd.DataFrame(columns=["tconst", "primaryTitle", "startYear", "poster_url", "persons"])
        return empty_df, matched

    # Build SQL with IN clause sized for nconsts
    placeholders = ','.join('?' for _ in nconsts)

    # We want films that include ALL of the provided people.
    # Use GROUP BY + HAVING COUNT(DISTINCT p.nconst) = number_of_people
    sql = f"""
    SELECT b.tconst,
           b.primaryTitle,
           b.startYear,
           tp.poster_url,
           GROUP_CONCAT(DISTINCT n.primaryName) AS persons
    FROM title_principals p
    JOIN title_basics b ON p.tconst = b.tconst
    JOIN name_basics n ON p.nconst = n.nconst
    LEFT JOIN tmdb_posters tp ON b.tconst = tp.tconst
    WHERE b.titleType = 'movie'
      AND p.nconst IN ({placeholders})
    GROUP BY b.tconst
    HAVING COUNT(DISTINCT p.nconst) = ?
    ORDER BY b.startYear DESC, b.primaryTitle;
    """

    start = time.time()
    params = list(nconsts) + [len(nconsts)]
    films_df = pd.read_sql_query(sql, conn, params=params)

    # films_df columns: tconst, primaryTitle, startYear, poster_url, persons

    return films_df, matched
