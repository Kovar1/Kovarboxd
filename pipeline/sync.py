"""Nightly update.

1. Read today's export. New IDs above the cutoff get inserted.
2. Ask /movie/changes which movies changed since the last good sync and queue
   the ones we store for a re-fetch.
3. Refresh popularity for every stored movie from the export (no API calls).
4. Mark stored movies missing from the export as removed, and clear the mark
   on any that came back.
5. Fetch everything queued in steps 1 and 2.

Every run writes a pipeline_runs row, and a failed run exits non-zero so the
GitHub Action shows red.

    python -m pipeline.sync
"""

import argparse
import logging
import sys
from datetime import datetime, timedelta, timezone

from pipeline import config, db, exports
from pipeline.backfill import fetch_pending, run

log = logging.getLogger(__name__)


def changes_window(last_ok_sync, today):
    """Dates for /movie/changes: from the last good sync up to today.

    Returns (None, None) on the first run, which makes TMDb use the past 24
    hours. The window is capped at CHANGES_MAX_DAYS, TMDb's own limit.
    """
    if last_ok_sync is None:
        return None, None
    start = last_ok_sync.astimezone(timezone.utc).date()
    earliest = today - timedelta(days=config.CHANGES_MAX_DAYS)
    if start < earliest:
        log.warning("Last good sync was %s, only checking changes since %s", start, earliest)
        start = earliest
    return start, today


def find_removals(stored, present):
    """Split stored movies into (newly missing, back again).

    stored is {tmdb_id: is_removed}, present is the set of IDs in the export.
    """
    missing = [i for i, removed in stored.items() if not removed and i not in present]
    returned = [i for i, removed in stored.items() if removed and i in present]
    return missing, returned


def body(conn, client, stats, cutoff):
    path = exports.download_export()
    stored = db.stored_movies(conn)
    scan = exports.scan_export(exports.iter_export(path), cutoff, stored.keys())
    log.info("Export %s has %s lines, %s stored movies, %s new above cutoff",
             path.name, f"{scan.lines:,}", f"{len(stored):,}", f"{len(scan.new):,}")
    if scan.lines < config.MIN_EXPORT_LINES:
        raise RuntimeError(f"Export has only {scan.lines:,} lines, refusing to sync from it")

    missing, returned = find_removals(stored, scan.stored_popularity.keys())
    if len(missing) > config.MAX_REMOVAL_FRACTION * len(stored):
        raise RuntimeError(
            f"{len(missing):,} of {len(stored):,} stored movies are missing from the export, "
            "which looks wrong. Nothing was marked removed."
        )
    stats.movies_removed = db.mark_removed(conn, missing)
    cleared = db.clear_removed(conn, returned)
    changed_pop = db.refresh_popularity(conn, scan.stored_popularity)
    log.info("Marked %s removed, %s back again, popularity changed on %s",
             f"{stats.movies_removed:,}", f"{cleared:,}", f"{changed_pop:,}")

    if db.over_budget(conn):
        stats.budget_reached = True
        log.warning("kovarboxd schema is at the size budget, not adding new movies")
    else:
        stats.movies_added = db.insert_new_movie_ids(conn, scan.new)

    today = datetime.now(timezone.utc).date()
    start, end = changes_window(db.last_ok_sync_started_at(conn), today)
    changed = client.changed_movie_ids(start, end)
    ours = [i for i, removed in stored.items() if not removed and i in changed]
    queued = db.mark_for_refetch(conn, ours)
    log.info("TMDb lists %s changed movies since %s, %s of them are ours",
             f"{len(changed):,}", start or "yesterday", f"{queued:,}")

    fetch_pending(conn, client, stats, limit=config.SYNC_MAX_FETCH)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Nightly sync with TMDb.")
    parser.add_argument("--cutoff", type=float, default=config.POPULARITY_CUTOFF,
                        help=f"popularity cutoff for new movies (default {config.POPULARITY_CUTOFF})")
    args = parser.parse_args(argv)
    return run("sync", lambda conn, client, stats: body(conn, client, stats, args.cutoff))


if __name__ == "__main__":
    sys.exit(main())
