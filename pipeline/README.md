# Kovarboxd data pipeline

Loads movies, people and credits from TMDb into the `kovarboxd` schema of a
Supabase Postgres database, and keeps them in sync every night. This is Phase 1
of the Kovarboxd remodel: TMDb is the source of truth, Postgres holds a trimmed
copy, and the Next.js app (Phase 2) reads from it.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## What's in here

```
supabase/migrations/   numbered SQL files, applied in order by migrate.py
pipeline/
  config.py      every tunable constant (cutoff, budget, credit trimming, rate limit)
  db.py          connection and write helpers, plain SQL
  tmdb.py        API client (throttle, retries) and API response to table rows
  exports.py     download and filter TMDb's daily ID export
  backfill.py    initial load, resumable
  sync.py        nightly update
  check.py       data quality and size report
  migrate.py     applies SQL migrations
tests/pipeline/  unit tests on saved TMDb responses, no network
.github/workflows/nightly-sync.yml
```

## Setup

Python 3.12 or newer.

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows; use .venv/bin/activate elsewhere
pip install -r pipeline/requirements.txt
cp .env.example .env            # then fill in both values
```

| Variable | What it is |
| --- | --- |
| `TMDB_API_TOKEN` | TMDb "API Read Access Token" (the long v4 token), sent as a Bearer header. From themoviedb.org/settings/api. |
| `SUPABASE_DB_URL` | Supabase **Session pooler** connection string (port 5432 on `*.pooler.supabase.com`). Not the direct connection: that one is IPv6 only and GitHub Actions can't reach it. |

`.env` is gitignored. In GitHub Actions both come from repository secrets with
the same names.

## Running it

All commands run from the repo root.

```bash
python -m pipeline.migrate                     # create or update the schema
python -m pipeline.backfill                    # initial load, safe to rerun
python -m pipeline.backfill --limit 500        # fetch at most 500 movies
python -m pipeline.backfill --cutoff 5         # different popularity cutoff
python -m pipeline.sync                        # what the nightly Action runs
python -m pipeline.check                       # counts, sizes, last runs
python -m pipeline.exports --top 2000          # popularity of the 2,000th movie
python -m pipeline.exports --counts 3,4,5      # movies at or above each cutoff
python -m pytest                               # unit tests
```

### Backfill

1. Downloads today's export (or yesterday's if today's isn't up yet) to
   `.cache/exports/`, drops adult and video entries, and inserts every movie
   at or above the popularity cutoff with `details_fetched_at` null.
2. Fetches `GET /3/movie/{id}?append_to_response=credits` for each of those,
   most popular first, with 6 worker threads sharing one rate limiter. Each
   movie's row, genres, people and credits are written in one transaction,
   which also sets `details_fetched_at`.

If it stops for any reason, run it again: it picks up the movies that still
have `details_fetched_at` null. A movie the API answers 404 for gets
`removed_at` set so it isn't retried forever.

### Nightly sync

1. Reads today's export. New IDs at or above the cutoff are inserted.
2. Asks `GET /3/movie/changes` for everything changed since the last
   successful sync (the past 24 hours on the first run, at most 14 days) and
   queues the changed movies we store for a re-fetch.
3. Copies `popularity` from the export onto every stored movie. No API calls.
4. Sets `removed_at` on stored movies missing from the export, and clears it
   on any that came back. Movies are never deleted.
5. Fetches everything queued, up to 30,000 movies per run.

Movies that drop below the cutoff later are kept, so the table only grows
when new movies cross it.

Two guards stop a bad export from doing damage: a file with fewer than
500,000 lines is refused, and a run that would mark more than 2% of stored
movies as removed fails without marking any.

### pipeline_runs

Every backfill and sync writes one row, whether it succeeds or not.

| Column | Meaning |
| --- | --- |
| `ok` | true on success, false on failure, null while running |
| `error` | why it failed |
| `movies_added` | new movie IDs inserted from the export |
| `movies_updated` | movies whose details were fetched and written |
| `movies_removed` | movies newly marked removed (gone from the export, or 404) |
| `api_calls` | TMDb requests made, retries included |

A failed sync exits non-zero, so the GitHub Action shows red.
`python -m pipeline.check` prints the last 5 runs.

## The nightly GitHub Action

`.github/workflows/nightly-sync.yml` runs `python -m pipeline.sync` at
09:17 UTC every day, after TMDb publishes its export around 08:00 UTC. It uses
Python 3.12, a concurrency group so two runs never overlap, and a 60 minute
timeout. The last step prints the `check.py` report into the log.

Repository secrets it needs: `TMDB_API_TOKEN` and `SUPABASE_DB_URL`.

To run a backfill batch by hand: Actions > Nightly TMDb sync > Run workflow,
and fill in "backfill_limit" with a number of movies. Leave it empty for a
normal sync.

GitHub only runs scheduled workflows from the default branch, so the nightly
schedule starts once this is merged into `main`. Until then it can be run by
hand from the branch: `gh workflow run nightly-sync.yml --ref remodel/tmdb`.

## Database layout

Everything is in the `kovarboxd` schema of the Supabase project AMC-Assistant
uses, so it can't collide with AMC-Assistant's tables and Phase 4 can share
logins.

- `movies`, `genres`, `movie_genres`, `people`, `credits`, `pipeline_runs`,
  `schema_migrations`.
- Search: `pg_trgm` and `unaccent`, plus `kovarboxd.f_unaccent(text)`, an
  immutable wrapper so unaccent can be used in indexes and generated columns.
  `movies.search_tsv` is a generated tsvector over title and original title
  with a GIN index, and title and people names have trigram GIN indexes for
  typo tolerant search.
- `kovarboxd.films_together(int[])` returns every non-removed movie where all
  the given people have a credit, newest first.
- Row-Level Security is on for every table with no policies, so nothing is
  readable through Supabase's public API. The schema isn't in the exposed API
  schemas either. The pipeline connects as the table owner, which RLS doesn't
  apply to.

## Decisions and measurements

### Size budget

The Supabase free plan caps the whole database at 500 MB, shared with
AMC-Assistant. On 2026-10-29 the database used 12 MB, so the remaining space
minus 100 MB of headroom was 388 MB, and the budget is the 300 MB cap.
Backfill and sync stop adding movies once the schema reaches 95% of it
(`BUDGET_STOP_FRACTION`).

### Credit trimming

Full crew lists can run to hundreds of people per movie, so `config.py` keeps:

- Cast: the first `MAX_CAST = 25` by billing order.
- Crew: only Director, Screenplay, Writer, Story, Novel, Producer, Director of
  Photography, Original Music Composer, Editor and Casting (`CREW_JOBS`).

Across the full load TMDb listed 1,592,291 credits and we kept 541,459, 66%
fewer. A stored credit costs about 194 bytes with its indexes, so the kept
credits take 100 MB. Untrimmed they would take about 309 MB, more than the
whole budget, before counting the extra people rows the dropped crew would
have added. Popular movies have the longest crew lists: on the top 2,000
alone, 82% of credits were trimmed.

### Popularity cutoff

Picked by measuring rather than guessing:

1. Backfilled the top 2,000 movies (cutoff 10.25). After `VACUUM ANALYZE` the
   schema was 25.5 MB, 13.1 KB per movie: 6.5 KB of credits (34 per movie),
   5.1 KB of people (18.8 new people per movie, including a 5.5 MB trigram
   index on names), and 1.3 KB for the movie row and genres.
2. Less popular movies have smaller casts, so a flat 13.1 KB per movie
   overestimates. A random sample of 70 movies from each popularity band
   (no database writes) gave 31, 22 and 19 kept credits per movie for
   popularity 5 to 10, 3.5 to 5 and 2.5 to 3.5, with 15 to 18 people per movie
   not yet stored.
3. Summing per-band estimates, cutoff 3.6 gives about 22,000 movies and an
   estimated 231 MB, 77% of the budget. The flat estimate for the same
   cutoff was 281 MB, still under the 285 MB stop line.

The estimate turned out too high. Less popular movies share far more people
with each other than a comparison against only the top 2,000 suggested: the
full load averages 10.9 new people per movie, not 15 to 18. The real result
is 7.6 KB per movie and 54% of the budget.

### Full load, 2026-10-29

| | |
| --- | --- |
| Popularity cutoff | 3.6 |
| Movies | 22,039 (22,038 with details, 1 gone from TMDb) |
| People | 240,328 |
| Credits | 541,459 |
| Genres, movie_genres | 19, 47,916 |
| kovarboxd schema | 163 MB of the 300 MB budget (54%) |
| Whole database | 175 MB of the 500 MB plan limit (35%) |
| Backfill time | 20.3 min for 20,039 movies (16.5 per second), plus 2 min for the 2,000 movie sample |
| API calls | 22,040 across all backfill runs |

Biggest pieces: credits 100 MB (54 MB of it indexes), people 43 MB, movies
17 MB.

### Query timings

`EXPLAIN ANALYZE` against the full load, first run and repeat:

| Query | Plan | Cold | Warm |
| --- | --- | --- | --- |
| Title search "godfather" | GIN index on `search_tsv` | 3.3 ms | 0.06 ms |
| People typo search "scorcese" | trigram GIN index on names | 43.8 ms | 11.7 ms |
| `films_together` Scorsese, De Niro, Pesci | index only scan on `credits (person_id, movie_id)` | 3.3 ms | 0.3 ms |

`films_together` returns The Irishman, Casino, GoodFellas and Raging Bull.

For people search, ordering matches by plain `similarity()` puts Francesca
and Cathy Scorsese above Martin, because shorter names score higher. Ordering
by `word_similarity(query, name)` and then popularity puts Martin first at the
same speed.
