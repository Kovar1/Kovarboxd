"""Data quality and size report.

    python -m pipeline.check
"""

from pipeline import config, db

TABLES = ["movies", "genres", "movie_genres", "people", "credits", "pipeline_runs", "schema_migrations"]
MB = 1024 * 1024


def main():
    conn = db.connect()

    print("Row counts")
    for table in TABLES:
        n = conn.execute(f"select count(*) from kovarboxd.{table}").fetchone()[0]
        print(f"  {table:<18} {n:>12,}")
    fetched, removed = conn.execute(
        "select count(details_fetched_at), count(removed_at) from kovarboxd.movies"
    ).fetchone()
    print(f"  movies with details {fetched:,}, removed {removed:,}")

    print("\nSize (tables plus indexes)")
    rows = conn.execute(
        """
        select c.relname, pg_total_relation_size(c.oid), pg_indexes_size(c.oid)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = %s and c.relkind = 'r'
        order by 2 desc
        """,
        [config.SCHEMA],
    ).fetchall()
    for name, total, indexes in rows:
        print(f"  {name:<18} {total / MB:8.1f} MB  (indexes {indexes / MB:.1f} MB)")
    schema = db.schema_size_bytes(conn)
    database = db.database_size_bytes(conn)
    print(f"  kovarboxd schema   {schema / MB:8.1f} MB of {config.BUDGET_MB} MB budget "
          f"({100 * schema / (config.BUDGET_MB * MB):.0f}%)")
    print(f"  whole database     {database / MB:8.1f} MB of {config.DB_LIMIT_MB} MB plan limit "
          f"({100 * database / (config.DB_LIMIT_MB * MB):.0f}%)")

    stuck = conn.execute(
        "select count(*) from kovarboxd.movies where details_fetched_at is null and removed_at is null"
    ).fetchone()[0]
    print(f"\nMovies still waiting for details: {stuck:,}")

    orphans = conn.execute(
        """
        select count(*) from kovarboxd.credits c
        left join kovarboxd.people p on p.tmdb_id = c.person_id
        where p.tmdb_id is null
        """
    ).fetchone()[0]
    print(f"Credits pointing at missing people: {orphans:,}")

    print("\nLast 5 pipeline runs")
    runs = conn.execute(
        """
        select id, mode, started_at, finished_at - started_at, ok, movies_added,
               movies_updated, movies_removed, api_calls, error
        from kovarboxd.pipeline_runs order by id desc limit 5
        """
    ).fetchall()
    if not runs:
        print("  none yet")
    for rid, mode, started, took, ok, added, updated, removed, calls, error in runs:
        status = {True: "ok", False: "FAILED", None: "running"}[ok]
        took = str(took).split(".")[0] if took else "-"
        print(f"  #{rid} {mode:<8} {started:%Y-%m-%d %H:%M} UTC  {status:<7} took {took}  "
              f"+{added:,} ~{updated:,} -{removed:,}  {calls:,} API calls")
        if error:
            print(f"      {error[:300]}")
    conn.close()


if __name__ == "__main__":
    main()
