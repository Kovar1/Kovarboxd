"""Download and filter TMDb's daily movie ID export.

The export is a gzipped file with one JSON object per line, for example
{"adult":false,"id":550,"original_title":"Fight Club","popularity":15.4,"video":false}
It is read line by line and never loaded into memory whole.

Run "python -m pipeline.exports --top 2000" to see the popularity of the
2,000th movie, or "--counts 5,10,20" to count movies above each cutoff.
"""

import argparse
import gzip
import json
import logging
from datetime import datetime, timedelta, timezone

import requests

from pipeline import config

log = logging.getLogger(__name__)


def export_url(day):
    return config.EXPORT_URL.format(day=day)


def download_export(today=None):
    """Download today's export, or yesterday's if today's isn't published yet.

    Files are cached in .cache/exports, so a second run on the same day skips
    the download. Returns the local path.
    """
    today = today or datetime.now(timezone.utc).date()
    config.EXPORT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for day in (today, today - timedelta(days=1)):
        path = config.EXPORT_CACHE_DIR / f"movie_ids_{day:%m_%d_%Y}.json.gz"
        if path.exists():
            return path
        url = export_url(day)
        with requests.get(url, stream=True, timeout=60) as resp:
            # files.tmdb.org answers 403 for a file that isn't up yet.
            if resp.status_code in (403, 404):
                log.info("Export for %s is not published yet", day)
                continue
            resp.raise_for_status()
            partial = path.with_suffix(".part")
            with open(partial, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1 << 20):
                    f.write(chunk)
        partial.replace(path)
        log.info("Downloaded %s", url)
        return path
    raise RuntimeError(f"No TMDb export found for {today} or the day before")


def iter_export(path):
    """Yield one dict per line of a gzipped export file."""
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def keep(entry, cutoff):
    """True for a movie we want: not adult, not a video, popular enough."""
    if entry.get("adult") or entry.get("video"):
        return False
    return (entry.get("popularity") or 0) >= cutoff


def movies_above(entries, cutoff):
    """(id, popularity) pairs for entries that pass keep()."""
    return [(e["id"], e["popularity"]) for e in entries if keep(e, cutoff)]


class ExportScan:
    """What sync needs from one pass over the export."""

    def __init__(self):
        self.lines = 0
        self.new = []            # (id, popularity) above the cutoff that we don't store yet
        self.stored_popularity = {}  # tmdb_id -> popularity for movies we already store


def scan_export(entries, cutoff, stored_ids):
    scan = ExportScan()
    for e in entries:
        scan.lines += 1
        if e["id"] in stored_ids:
            # Any line counts as "still on TMDb", even one we'd filter out now.
            scan.stored_popularity[e["id"]] = e.get("popularity") or 0
        elif keep(e, cutoff):
            scan.new.append((e["id"], e["popularity"]))
    return scan


def main():
    parser = argparse.ArgumentParser(description="Inspect TMDb's daily movie export.")
    parser.add_argument("--top", type=int, help="print the popularity of the Nth most popular movie")
    parser.add_argument("--counts", help="comma separated cutoffs, print how many movies pass each")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

    path = download_export()
    pops = sorted((p for _, p in movies_above(iter_export(path), 0)), reverse=True)
    print(f"{len(pops):,} movies in {path.name} after dropping adult and video entries")
    if args.top:
        n = min(args.top, len(pops))
        print(f"#{n:,} most popular has popularity {pops[n - 1]}")
    if args.counts:
        for cutoff in (float(x) for x in args.counts.split(",")):
            print(f"popularity >= {cutoff:g}: {sum(1 for p in pops if p >= cutoff):,} movies")


if __name__ == "__main__":
    main()
