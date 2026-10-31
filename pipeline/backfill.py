"""Initial load. Resumable and safe to rerun.

1. Read today's export and insert every movie ID above the popularity cutoff.
2. Fetch details for every movie that doesn't have them yet, most popular
   first, and write each one in its own transaction.

Interrupting it is fine: rerunning picks up the movies still missing details.

    python -m pipeline.backfill                 full load
    python -m pipeline.backfill --limit 2000    fetch at most 2,000 movies
    python -m pipeline.backfill --cutoff 25     use a different popularity cutoff
"""

import argparse
import logging
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import psycopg

from pipeline import config, db, exports, tmdb

log = logging.getLogger(__name__)


class Stats:
    def __init__(self):
        self.movies_added = 0
        self.movies_updated = 0
        self.movies_removed = 0
        self.api_calls = 0
        self.failed = set()
        self.budget_reached = False
        # Raw vs kept credit counts, for the trimming report.
        self.raw_cast = self.raw_crew = self.kept_cast = self.kept_crew = 0
        self._lock = threading.Lock()

    def record_fetch(self, counts):
        with self._lock:
            self.movies_updated += 1
            raw_cast, raw_crew, kept_cast, kept_crew = counts
            self.raw_cast += raw_cast
            self.raw_crew += raw_crew
            self.kept_cast += kept_cast
            self.kept_crew += kept_crew

    def record_missing(self):
        with self._lock:
            self.movies_removed += 1

    def credit_summary(self):
        raw = self.raw_cast + self.raw_crew
        kept = self.kept_cast + self.kept_crew
        if not raw:
            return "no credits seen"
        return (
            f"credits seen {raw:,} (cast {self.raw_cast:,}, crew {self.raw_crew:,}), "
            f"kept {kept:,} (cast {self.kept_cast:,}, crew {self.kept_crew:,}), "
            f"{100 * (1 - kept / raw):.0f}% trimmed"
        )


def _process_one(client, conns, stats, tmdb_id):
    """Fetch and write one movie. Returns True on success."""
    try:
        data = client.movie(tmdb_id)
        conn = conns.get()
        if data is None:
            db.mark_missing(conn, tmdb_id)
            stats.record_missing()
            return True
        rows = tmdb.to_rows(data)
        try:
            db.write_movie(conn, rows)
        except (psycopg.errors.DeadlockDetected, psycopg.errors.SerializationFailure):
            db.write_movie(conn, rows)
        stats.record_fetch(tmdb.credit_counts(data))
        return True
    except Exception as exc:
        log.error("movie %s failed: %s", tmdb_id, exc)
        return False


def fetch_pending(conn, client, stats, limit=None):
    """Fetch details for movies that don't have them yet, most popular first.

    Stops when nothing is left, when `limit` movies are done, when the schema
    reaches the size budget, or after too many failures.
    """
    total = db.count_pending(conn)
    if limit is not None:
        total = min(total, limit)
    log.info("%s movies to fetch", f"{total:,}")
    if not total:
        return

    conns = db.ThreadConnections()
    pool = ThreadPoolExecutor(max_workers=config.WORKERS)
    done = 0
    started = time.monotonic()
    try:
        while limit is None or done < limit:
            if db.over_budget(conn):
                stats.budget_reached = True
                log.warning("kovarboxd schema is at the size budget, stopping")
                break
            size = config.BATCH_SIZE if limit is None else min(config.BATCH_SIZE, limit - done)
            ids = db.pending_movie_ids(conn, size, exclude=stats.failed)
            if not ids:
                break
            results = pool.map(lambda i: (i, _process_one(client, conns, stats, i)), ids)
            for tmdb_id, ok in results:
                done += 1
                if not ok:
                    stats.failed.add(tmdb_id)
                if done % config.PROGRESS_EVERY == 0 or done == total:
                    rate = done / (time.monotonic() - started)
                    left = max(total - done, 0) / rate if rate else 0
                    log.info(
                        "%s/%s movies, %.1f per second, about %.0f min left, %s API calls",
                        f"{done:,}", f"{total:,}", rate, left / 60, f"{client.calls:,}",
                    )
            if len(stats.failed) > config.MAX_FAILURES:
                raise RuntimeError(f"{len(stats.failed)} movies failed, giving up")
    finally:
        # On Ctrl-C, drop the queued movies instead of finishing the batch.
        pool.shutdown(wait=True, cancel_futures=True)
        conns.close_all()


def run(mode, body):
    """Run body(conn, client, stats) and record it in pipeline_runs either way.

    Returns the process exit code: 0 on success, 1 on failure.
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    conn = db.connect()
    client = tmdb.TmdbClient()
    stats = Stats()
    run_id = db.start_run(conn, mode)
    started = time.monotonic()
    error = None
    try:
        body(conn, client, stats)
        if stats.failed:
            error = f"{len(stats.failed)} movies failed: {sorted(stats.failed)[:20]}"
        elif stats.budget_reached:
            error = "kovarboxd schema reached its size budget, new movies were skipped"
    except KeyboardInterrupt:
        error = "interrupted"
    except Exception as exc:
        log.exception("%s failed", mode)
        error = f"{type(exc).__name__}: {exc}"[:2000]
    stats.api_calls = client.calls

    try:
        if conn.closed or conn.broken:
            conn = db.connect()
        db.finish_run(conn, run_id, error is None, error, stats)
    finally:
        conn.close()

    minutes = (time.monotonic() - started) / 60
    log.info(
        "%s %s in %.1f min: %s added, %s updated, %s removed, %s API calls",
        mode, "finished" if error is None else "FAILED", minutes, f"{stats.movies_added:,}",
        f"{stats.movies_updated:,}", f"{stats.movies_removed:,}", f"{stats.api_calls:,}",
    )
    log.info("Credit trimming: %s", stats.credit_summary())
    if error:
        log.error("%s", error)
    return 0 if error is None else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description="Initial load of movies, people and credits.")
    parser.add_argument("--limit", type=int, help="fetch at most this many movies")
    parser.add_argument("--cutoff", type=float, default=config.POPULARITY_CUTOFF,
                        help=f"popularity cutoff (default {config.POPULARITY_CUTOFF})")
    args = parser.parse_args(argv)

    def body(conn, client, stats):
        path = exports.download_export()
        pairs = exports.movies_above(exports.iter_export(path), args.cutoff)
        log.info("%s movies in the export at popularity >= %g", f"{len(pairs):,}", args.cutoff)
        stats.movies_added = db.insert_new_movie_ids(conn, pairs)
        log.info("%s of them are new", f"{stats.movies_added:,}")
        fetch_pending(conn, client, stats, limit=args.limit)

    return run("backfill", body)


if __name__ == "__main__":
    sys.exit(main())
