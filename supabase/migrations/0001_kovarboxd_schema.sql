-- Kovarboxd schema: movies, people and credits loaded from TMDb.
-- Everything lives in the kovarboxd schema so it never collides with
-- AMC-Assistant's tables in the same Supabase project.

create schema if not exists kovarboxd;

-- Supabase keeps extensions in the "extensions" schema.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE (it reads a dictionary that could change), so it
-- cannot be used in generated columns or index expressions. This wrapper pins
-- the dictionary by name, which makes it safe to declare IMMUTABLE.
create or replace function kovarboxd.f_unaccent(text)
returns text
language sql
immutable parallel safe strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;


-- Movies ---------------------------------------------------------------------

create table kovarboxd.movies (
  tmdb_id            integer primary key,
  imdb_id            text,
  title              text,
  original_title     text,
  original_language  text,
  release_date       date,
  release_year       integer generated always as (extract(year from release_date)::integer) stored,
  runtime            integer,
  overview           text,
  tagline            text,
  poster_path        text,
  backdrop_path      text,
  popularity         real,
  vote_average       real,
  vote_count         integer,
  budget             bigint,
  revenue            bigint,
  status             text,
  -- Null until the pipeline has fetched full details from the API.
  details_fetched_at timestamptz,
  updated_at         timestamptz not null default now(),
  -- Set when the movie disappears from TMDb's daily export. Rows are never deleted.
  removed_at         timestamptz,
  search_tsv         tsvector generated always as (
    to_tsvector('simple', kovarboxd.f_unaccent(coalesce(title, '') || ' ' || coalesce(original_title, '')))
  ) stored
);

create index movies_search_tsv_idx on kovarboxd.movies using gin (search_tsv);
create index movies_title_trgm_idx on kovarboxd.movies
  using gin (lower(kovarboxd.f_unaccent(title)) extensions.gin_trgm_ops);
-- Lets the pipeline find the next movies to fetch without scanning the table.
create index movies_pending_idx on kovarboxd.movies (popularity desc)
  where details_fetched_at is null and removed_at is null;


-- Genres ---------------------------------------------------------------------

create table kovarboxd.genres (
  id   integer primary key,
  name text not null
);

create table kovarboxd.movie_genres (
  movie_id integer not null references kovarboxd.movies (tmdb_id),
  genre_id integer not null references kovarboxd.genres (id),
  primary key (movie_id, genre_id)
);


-- People ---------------------------------------------------------------------

create table kovarboxd.people (
  tmdb_id              integer primary key,
  name                 text not null,
  profile_path         text,
  known_for_department text,
  gender               smallint,
  popularity           real,
  -- Filled on demand in Phase 2, empty in Phase 1.
  biography            text,
  birthday             date,
  deathday             date,
  place_of_birth       text,
  details_fetched_at   timestamptz
);

create index people_name_trgm_idx on kovarboxd.people
  using gin (lower(kovarboxd.f_unaccent(name)) extensions.gin_trgm_ops);


-- Credits --------------------------------------------------------------------

create table kovarboxd.credits (
  credit_id  text primary key,
  movie_id   integer not null references kovarboxd.movies (tmdb_id),
  person_id  integer not null references kovarboxd.people (tmdb_id),
  kind       text not null check (kind in ('cast', 'crew')),
  character  text,
  cast_order smallint,
  department text,
  job        text
);

create index credits_person_movie_idx on kovarboxd.credits (person_id, movie_id);
create index credits_movie_idx on kovarboxd.credits (movie_id);


-- Pipeline runs ----------------------------------------------------------------

create table kovarboxd.pipeline_runs (
  id             bigint generated always as identity primary key,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  mode           text not null check (mode in ('backfill', 'sync')),
  ok             boolean,
  error          text,
  movies_added   integer not null default 0,
  movies_updated integer not null default 0,
  movies_removed integer not null default 0,
  api_calls      integer not null default 0
);


-- Films together -----------------------------------------------------------------

-- Every non-removed movie where all of the given people have a credit, newest
-- first. Duplicate IDs in the input array are ignored.
create or replace function kovarboxd.films_together(person_ids int[])
returns setof kovarboxd.movies
language sql
stable
as $$
  select m.*
  from kovarboxd.movies m
  join (
    select c.movie_id
    from kovarboxd.credits c
    where c.person_id = any (person_ids)
    group by c.movie_id
    having count(distinct c.person_id) = (select count(distinct p) from unnest(person_ids) as p)
  ) shared on shared.movie_id = m.tmdb_id
  where m.removed_at is null
  order by m.release_date desc nulls last, m.tmdb_id
$$;


-- Security -------------------------------------------------------------------

-- RLS with no policies: nothing is readable through Supabase's public API until
-- Phase 2 adds policies on purpose. The pipeline connects as the table owner,
-- which RLS does not apply to.
alter table kovarboxd.movies        enable row level security;
alter table kovarboxd.genres        enable row level security;
alter table kovarboxd.movie_genres  enable row level security;
alter table kovarboxd.people        enable row level security;
alter table kovarboxd.credits       enable row level security;
alter table kovarboxd.pipeline_runs enable row level security;
