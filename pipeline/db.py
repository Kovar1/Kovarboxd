"""Postgres connection and write helpers. Plain SQL, no ORM."""

import os
import threading

import psycopg

from pipeline import config


def connect():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise SystemExit("SUPABASE_DB_URL is not set. Add it to .env or the environment.")
    return psycopg.connect(
        url,
        autocommit=True,
        connect_timeout=20,
        application_name="kovarboxd-pipeline",
    )


class ThreadConnections:
    """One connection per worker thread, all closed together at the end."""

    def __init__(self):
        self._local = threading.local()
        self._lock = threading.Lock()
        self._all = []

    def get(self):
        conn = getattr(self._local, "conn", None)
        if conn is None or conn.closed:
            conn = connect()
            self._local.conn = conn
            with self._lock:
                self._all.append(conn)
        return conn

    def close_all(self):
        with self._lock:
            for conn in self._all:
                conn.close()
            self._all.clear()


# Movie IDs ------------------------------------------------------------------

def insert_new_movie_ids(conn, pairs):
    """Insert (tmdb_id, popularity) pairs we don't have yet. Returns how many were new."""
    with conn.transaction():
        conn.execute("create temp table export_ids (tmdb_id integer, popularity real) on commit drop")
        with conn.cursor().copy("copy export_ids (tmdb_id, popularity) from stdin") as copy:
            for pair in pairs:
                copy.write_row(pair)
        cur = conn.execute(
            """
            insert into kovarboxd.movies (tmdb_id, popularity)
            select tmdb_id, popularity from export_ids
            on conflict (tmdb_id) do nothing
            """
        )
        return cur.rowcount


def stored_movies(conn):
    """Return {tmdb_id: is_removed} for every stored movie."""
    rows = conn.execute("select tmdb_id, removed_at is not null from kovarboxd.movies").fetchall()
    return dict(rows)


def refresh_popularity(conn, popularity):
    """Set popularity from a {tmdb_id: popularity} dict. Returns rows changed."""
    with conn.transaction():
        conn.execute("create temp table export_pop (tmdb_id integer, popularity real) on commit drop")
        with conn.cursor().copy("copy export_pop (tmdb_id, popularity) from stdin") as copy:
            for pair in popularity.items():
                copy.write_row(pair)
        cur = conn.execute(
            """
            update kovarboxd.movies m
            set popularity = e.popularity
            from export_pop e
            where m.tmdb_id = e.tmdb_id and m.popularity is distinct from e.popularity
            """
        )
        return cur.rowcount


def mark_removed(conn, ids):
    cur = conn.execute(
        "update kovarboxd.movies set removed_at = now() where tmdb_id = any(%s) and removed_at is null",
        [list(ids)],
    )
    return cur.rowcount


def clear_removed(conn, ids):
    cur = conn.execute(
        "update kovarboxd.movies set removed_at = null where tmdb_id = any(%s) and removed_at is not null",
        [list(ids)],
    )
    return cur.rowcount


def mark_for_refetch(conn, ids):
    """Queue already fetched movies to be fetched again."""
    cur = conn.execute(
        """
        update kovarboxd.movies set details_fetched_at = null
        where tmdb_id = any(%s) and details_fetched_at is not null and removed_at is null
        """,
        [list(ids)],
    )
    return cur.rowcount


def count_pending(conn):
    return conn.execute(
        "select count(*) from kovarboxd.movies where details_fetched_at is null and removed_at is null"
    ).fetchone()[0]


def pending_movie_ids(conn, limit, exclude=()):
    """Next movies to fetch, most popular first."""
    rows = conn.execute(
        """
        select tmdb_id from kovarboxd.movies
        where details_fetched_at is null and removed_at is null
          and not (tmdb_id = any(%s))
        order by popularity desc nulls last
        limit %s
        """,
        [list(exclude), limit],
    ).fetchall()
    return [r[0] for r in rows]


# Writing one movie ----------------------------------------------------------

MOVIE_COLUMNS = [
    "tmdb_id", "imdb_id", "title", "original_title", "original_language", "release_date",
    "runtime", "overview", "tagline", "poster_path", "backdrop_path", "popularity",
    "vote_average", "vote_count", "budget", "revenue", "status",
]
PEOPLE_COLUMNS = ["tmdb_id", "name", "profile_path", "known_for_department", "gender", "popularity"]
CREDIT_COLUMNS = [
    "credit_id", "movie_id", "person_id", "kind", "character", "cast_order", "department", "job",
]


def _insert_sql(table, columns):
    names = ", ".join(columns)
    values = ", ".join(f"%({c})s" for c in columns)
    return f"insert into kovarboxd.{table} ({names}) values ({values})"


def _set_from_excluded(columns):
    return ", ".join(f"{c} = excluded.{c}" for c in columns)


UPSERT_MOVIE = (
    _insert_sql("movies", MOVIE_COLUMNS)
    + " on conflict (tmdb_id) do update set "
    + _set_from_excluded(MOVIE_COLUMNS[1:])
    + ", details_fetched_at = now(), updated_at = now(), removed_at = null"
)
# Only rewrite a person when something changed, which keeps dead rows down
# when the same actor shows up in hundreds of movies.
UPSERT_PERSON = (
    _insert_sql("people", PEOPLE_COLUMNS)
    + " on conflict (tmdb_id) do update set "
    + _set_from_excluded(PEOPLE_COLUMNS[1:])
    + " where ("
    + ", ".join(f"people.{c}" for c in PEOPLE_COLUMNS[1:])
    + ") is distinct from ("
    + ", ".join(f"excluded.{c}" for c in PEOPLE_COLUMNS[1:])
    + ")"
)
UPSERT_CREDIT = (
    _insert_sql("credits", CREDIT_COLUMNS)
    + " on conflict (credit_id) do update set "
    + _set_from_excluded(CREDIT_COLUMNS[1:])
)
# "do nothing" instead of "do update" so workers never wait on each other for
# the lock on a popular genre row like Drama.
INSERT_GENRE = "insert into kovarboxd.genres (id, name) values (%(id)s, %(name)s) on conflict (id) do nothing"


def write_movie(conn, rows):
    """Write one movie with its genres, people and credits in a single transaction.

    rows is the dict from tmdb.to_rows(). Old genres and credits for the movie
    are replaced, so a re-fetch drops credits TMDb no longer lists.
    """
    movie_id = rows["movie"]["tmdb_id"]
    # Pipeline mode sends every statement in one round trip instead of one each.
    with conn.pipeline(), conn.transaction():
        cur = conn.cursor()
        cur.execute(UPSERT_MOVIE, rows["movie"])
        if rows["genres"]:
            cur.executemany(INSERT_GENRE, rows["genres"])
        cur.execute("delete from kovarboxd.movie_genres where movie_id = %s", [movie_id])
        if rows["movie_genres"]:
            cur.executemany(
                "insert into kovarboxd.movie_genres (movie_id, genre_id) values (%(movie_id)s, %(genre_id)s)",
                rows["movie_genres"],
            )
        # People are sorted by id, so two workers that share actors always
        # lock them in the same order and can't deadlock.
        if rows["people"]:
            cur.executemany(UPSERT_PERSON, rows["people"])
        cur.execute("delete from kovarboxd.credits where movie_id = %s", [movie_id])
        if rows["credits"]:
            cur.executemany(UPSERT_CREDIT, rows["credits"])


def mark_missing(conn, tmdb_id):
    """The API returned 404: the movie is gone, so stop trying to fetch it."""
    conn.execute(
        "update kovarboxd.movies set removed_at = now() where tmdb_id = %s and removed_at is null",
        [tmdb_id],
    )


# Pipeline runs and sizes ----------------------------------------------------

def start_run(conn, mode):
    return conn.execute(
        "insert into kovarboxd.pipeline_runs (mode) values (%s) returning id", [mode]
    ).fetchone()[0]


def finish_run(conn, run_id, ok, error, stats):
    conn.execute(
        """
        update kovarboxd.pipeline_runs
        set finished_at = now(), ok = %s, error = %s, movies_added = %s,
            movies_updated = %s, movies_removed = %s, api_calls = %s
        where id = %s
        """,
        [ok, error, stats.movies_added, stats.movies_updated, stats.movies_removed,
         stats.api_calls, run_id],
    )


def last_ok_sync_started_at(conn):
    return conn.execute(
        "select max(started_at) from kovarboxd.pipeline_runs where mode = 'sync' and ok"
    ).fetchone()[0]


def schema_size_bytes(conn):
    """Tables plus their indexes and TOAST data in the kovarboxd schema."""
    return conn.execute(
        """
        select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = %s and c.relkind in ('r', 'm')
        """,
        [config.SCHEMA],
    ).fetchone()[0]


def database_size_bytes(conn):
    return conn.execute("select pg_database_size(current_database())").fetchone()[0]


def over_budget(conn):
    limit = config.BUDGET_MB * 1024 * 1024 * config.BUDGET_STOP_FRACTION
    return schema_size_bytes(conn) >= limit
