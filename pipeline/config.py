"""Every tunable constant for the pipeline lives here."""

from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent

# Local runs read secrets from a gitignored .env. In GitHub Actions they come
# from repository secrets, and a missing .env is fine.
load_dotenv(REPO_ROOT / ".env")

SCHEMA = "kovarboxd"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"


# Which movies we keep -------------------------------------------------------

# Movies whose popularity in TMDb's daily export is at or above this value get
# loaded. Picked by measuring the size of a 2,000 movie sample, see README.
# On 2026-10-29, 3.6 meant about 22,000 movies.
POPULARITY_CUTOFF = 3.6


# Size budget ----------------------------------------------------------------

# Supabase free plan: 500 MB per project database, shared with AMC-Assistant.
DB_LIMIT_MB = 500
# On 2026-10-29 the database used 12 MB. Remaining space minus 100 MB of
# headroom is 388 MB, capped at 300 MB.
BUDGET_MB = 300
# Backfill and sync stop adding new movies once the kovarboxd schema reaches
# this share of the budget.
BUDGET_STOP_FRACTION = 0.95


# Credit trimming ------------------------------------------------------------

# Keep the first MAX_CAST cast members by billing order.
MAX_CAST = 25
# Keep only crew members with one of these jobs.
CREW_JOBS = {
    "Director",
    "Screenplay",
    "Writer",
    "Story",
    "Novel",
    "Producer",
    "Director of Photography",
    "Original Music Composer",
    "Editor",
    "Casting",
}


# TMDb API ---------------------------------------------------------------------

TMDB_API_BASE = "https://api.themoviedb.org/3"
REQUESTS_PER_SECOND = 20
HTTP_TIMEOUT_SECONDS = 20
MAX_RETRIES = 5
# Retry waits are BACKOFF_SECONDS * 2 ** attempt: 1, 2, 4, 8, 16 seconds.
BACKOFF_SECONDS = 1.0
# TMDb's /movie/changes accepts at most a 14 day window.
CHANGES_MAX_DAYS = 14


# Daily ID export ------------------------------------------------------------

EXPORT_URL = "https://files.tmdb.org/p/exports/movie_ids_{day:%m_%d_%Y}.json.gz"
EXPORT_CACHE_DIR = REPO_ROOT / ".cache" / "exports"
# A real export has about a million lines. Anything much smaller is treated as
# a broken download, so we never mark half the catalog as removed.
MIN_EXPORT_LINES = 500_000
# Sync refuses to mark more than this share of stored movies as removed in one run.
MAX_REMOVAL_FRACTION = 0.02


# Fetching -------------------------------------------------------------------

# Worker threads that fetch from TMDb and write to Postgres. Each one holds its
# own database connection, so keep this well under the pooler's connection limit.
WORKERS = 6
# Movies claimed from the database per round.
BATCH_SIZE = 500
# A run gives up once this many movies have failed to fetch or write.
MAX_FAILURES = 50
# Most movies a nightly sync will fetch, to stay inside the Action's 60 minutes.
SYNC_MAX_FETCH = 30_000
# Print progress every this many movies.
PROGRESS_EVERY = 250
