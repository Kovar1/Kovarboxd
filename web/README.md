# Kovarboxd (web)

Pick two or more people and see every film they made together. Also search
movies and people and browse their pages. Next.js (App Router) on Vercel,
reading the `kovarboxd` catalog in Supabase that the Python pipeline in
`../pipeline` loads from TMDb every night.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Pages

| Route | What |
| --- | --- |
| `/` | The films-together picker with example searches, then the most popular movies |
| `/together?ids=1032,380,4517` | Films together: every movie all the chosen people have a credit on, newest first, with each person's roles. Up to 6 people. The URL can be shared |
| `/search?q=` | Movie and people results. The header search box shows suggestions as you type, from `/api/search` |
| `/movie/769-goodfellas` | Poster, backdrop, facts, overview, key crew by job, top billed cast, IMDb and TMDB links |
| `/person/1032-martin-scorsese` | Photo, life facts, biography, known for, filmography as cast and crew, newest first |

Only the number in a movie or person URL is used for the lookup. A missing or
outdated name part redirects to the current one.

## Local setup

Node 24.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. The Supabase values are
   the same as AMC-Assistant's (same project).
3. The database side lives in `../supabase/migrations` and is applied with
   `python -m pipeline.migrate` from the repo root. `0002_web_access.sql` is the
   one this app needs.
4. Supabase dashboard > Project Settings > Data API > Exposed schemas: add
   `kovarboxd`. Without it every query fails.
5. `npm run dev`, then <http://localhost:3000>.

| Variable | Used for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reading the catalog |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Saving person details fetched on demand, nothing else |
| `TMDB_API_TOKEN` | Server only. Fetching person details on demand |

## Checks

| Command | What |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests, plus a live check of what the anon key can and can't do (skips itself without `.env.local`) |
| `npm run build` | Production build |

## How it reads data

- The app reads through Supabase's Data API with the anon key, like
  AMC-Assistant. Migration 0002 grants read-only access to the catalog tables
  (movies, genres, movie_genres, people, credits). RLS hides movies that were
  never loaded or are gone from TMDB. `pipeline_runs` and `schema_migrations`
  have no grants.
- Search goes through two SQL functions, `kovarboxd.search_movies` and
  `kovarboxd.search_people`, because the Data API can't express trigram
  ranking:
  - Movies: each word matches as a prefix ("godf" finds The Godfather), with
    a trigram fallback for typos ("godfahter"). An exact title ranks first,
    then word matches, then typo matches, weighted by popularity.
  - People: word similarity weighted by popularity, so "kubrik" finds Stanley
    Kubrick and "scorcese" puts Martin Scorsese first.
- Every catalog read is cached for hours with `"use cache"` (Cache
  Components). The data only changes when the nightly sync runs. The most
  popular movies and a few directors are built ahead of time; every other page
  is built on its first visit and cached after that.
- Images load straight from TMDB's image CDN in its standard sizes, through a
  custom `next/image` loader (`lib/tmdb-image-loader.ts`), so Vercel's image
  optimization quota isn't used.

## Films together

The people picker suggests names as you type, with a photo and department so
people who share a name can be told apart. Each pick or removal changes the
URL, and the page asks `kovarboxd.films_together(person_ids)` for the movies
everyone has a credit on (cast or crew), then one more query for what each
person did on each one. Results are cached for hours per set of people.

It only sees the credits the pipeline keeps: the top 25 billed cast and the
key crew jobs listed in `pipeline/config.py`. Someone billed 40th, or a crew
member in a job outside that list, won't connect films.

Every person page links here with that person already picked.

## Person details on demand

The pipeline doesn't load biographies, birthdays or birthplaces. When someone
opens a person page whose details are missing or older than 30 days, the page
asks `POST /api/person/[id]/details` from the browser. That route fetches them
from TMDB, saves them with `kovarboxd.save_person_details` (only the service
role can call it), marks the cached page stale with `revalidateTag`, and
returns them for the page to show.

It runs from the browser, not while the page renders, on purpose: Next.js
prefetches the pages behind visible links, so a movie page would otherwise
pull and save details for its whole cast before anyone clicks. Crawlers that
don't run JavaScript or send POSTs never trigger it either.

That function refuses to write once the `kovarboxd` schema reaches 95% of its
300 MB budget, the same stop line the pipeline uses. Measured on 2026-10-31,
a biography averages about 1 KB for the 1,000 most popular people and 121
bytes for a random person (77% have none), so even every person page being
visited would add roughly 40 MB. `robots.txt` and a `noindex` tag keep
crawlers away until Phase 4 adds login.

## Deploying to Vercel

1. Vercel > Add New Project > import `Kovar1/Kovarboxd`.
2. Root Directory: `web`. Framework preset: Next.js.
3. Environment variables (Production and Preview): the four in the table
   above.
4. Production deploys from `main`. Every branch and PR gets a preview URL,
   protected by Vercel's login by default.

`vercel.json` runs the functions in `pdx1` (Portland), next to the Supabase
database in AWS us-west-2. From the East Coast a fresh search took about
360 ms, mostly round trips to Oregon.
