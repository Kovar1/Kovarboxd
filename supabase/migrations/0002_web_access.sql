-- Read access for the Kovarboxd web app (Phase 2), search functions, and the
-- on-demand person details save.
--
-- The app reads through Supabase's Data API with the anon key, like
-- AMC-Assistant. That also needs "kovarboxd" ticked under Exposed schemas in
-- the Supabase dashboard (Data API settings). Only the catalog tables are
-- readable: pipeline_runs and schema_migrations get no grants and stay closed.

-- Load pg_trgm in this session. Until it's loaded its settings are unknown
-- placeholders, and only a superuser may pin those on a function, so the
-- "set pg_trgm.word_similarity_threshold" lines below would be refused.
select extensions.similarity('', '');

grant usage on schema kovarboxd to anon, authenticated, service_role;

grant select on
  kovarboxd.movies,
  kovarboxd.genres,
  kovarboxd.movie_genres,
  kovarboxd.people,
  kovarboxd.credits
to anon, authenticated;

-- Movies that were never loaded or are gone from TMDb are hidden here, so the
-- app can't show them by accident. "Never loaded" is title is null: only the
-- placeholder rows the pipeline inserts from the export lack a title.
-- details_fetched_at isn't used because the sync also clears it to queue a
-- re-fetch of a changed movie, which must stay visible meanwhile.
-- Credits and genres of hidden movies stay readable but lead nowhere: the app
-- embeds movies with an inner join.
create policy "readable catalog movies" on kovarboxd.movies
  for select to anon, authenticated
  using (removed_at is null and title is not null);

create policy "readable genres" on kovarboxd.genres
  for select to anon, authenticated using (true);

create policy "readable movie genres" on kovarboxd.movie_genres
  for select to anon, authenticated using (true);

create policy "readable people" on kovarboxd.people
  for select to anon, authenticated using (true);

create policy "readable credits" on kovarboxd.credits
  for select to anon, authenticated using (true);


-- Search --------------------------------------------------------------------

-- Movie search for the search page and the typeahead.
-- Every word of the query matches as a prefix ("godf" finds The Godfather)
-- through the search_tsv index. Titles that are close but misspelled
-- ("godfahter") come from the trigram index. An exact title ranks first, then
-- word matches, then typo matches, each weighted by popularity.
create or replace function kovarboxd.search_movies(q text, max_results int default 20)
returns table (
  tmdb_id int,
  title text,
  original_title text,
  release_year int,
  poster_path text,
  popularity real
)
language sql
stable
set search_path = kovarboxd, extensions, public
set pg_trgm.word_similarity_threshold = 0.5
as $$
  with input as (
    select lower(kovarboxd.f_unaccent(btrim(q))) as nq
  ), terms as (
    select
      nq,
      to_tsquery('simple', coalesce((
        select string_agg(quote_literal(w) || ':*', ' & ')
        from unnest(regexp_split_to_array(nq, '[^[:alnum:]]+')) as w
        where w <> ''
      ), '')) as tsq
    from input
  )
  select m.tmdb_id, m.title, m.original_title, m.release_year, m.poster_path, m.popularity
  from kovarboxd.movies m
  cross join terms t
  where length(t.nq) >= 2
    and m.removed_at is null
    and m.title is not null
    and (m.search_tsv @@ t.tsq or t.nq <% lower(kovarboxd.f_unaccent(m.title)))
  order by
    (case
       when lower(kovarboxd.f_unaccent(m.title)) = t.nq then 3
       when m.search_tsv @@ t.tsq then 2
       else 1 + word_similarity(t.nq, lower(kovarboxd.f_unaccent(m.title)))
     end) * ln(2 + coalesce(m.popularity, 0)) desc,
    m.tmdb_id
  limit max_results
$$;

-- People search. Word similarity rather than plain similarity, so "kubrik"
-- finds Stanley Kubrick and "scorcese" ranks Martin Scorsese first: plain
-- similarity favors short names and misses typos inside long ones.
create or replace function kovarboxd.search_people(q text, max_results int default 20)
returns table (
  tmdb_id int,
  name text,
  profile_path text,
  known_for_department text,
  popularity real
)
language sql
stable
set search_path = kovarboxd, extensions, public
set pg_trgm.word_similarity_threshold = 0.5
as $$
  with input as (
    select lower(kovarboxd.f_unaccent(btrim(q))) as nq
  )
  select p.tmdb_id, p.name, p.profile_path, p.known_for_department, p.popularity
  from kovarboxd.people p
  cross join input i
  where length(i.nq) >= 2
    and i.nq <% lower(kovarboxd.f_unaccent(p.name))
  order by
    word_similarity(i.nq, lower(kovarboxd.f_unaccent(p.name))) * ln(2 + coalesce(p.popularity, 0)) desc,
    p.tmdb_id
  limit max_results
$$;

grant execute on function kovarboxd.search_movies(text, int) to anon, authenticated;
grant execute on function kovarboxd.search_people(text, int) to anon, authenticated;


-- On-demand person details --------------------------------------------------

-- The app fetches biography, birthday, deathday and place of birth from TMDb
-- the first time someone opens a person page, and saves them here. Only the
-- server-side service role can call it. It refuses to write once the
-- kovarboxd schema reaches 95% of its 300 MB budget, the same stop line the
-- pipeline uses (pipeline/config.py), and returns false in that case.
create or replace function kovarboxd.save_person_details(
  person_id int,
  new_biography text,
  new_birthday date,
  new_deathday date,
  new_place_of_birth text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  schema_bytes bigint;
begin
  select coalesce(sum(pg_catalog.pg_total_relation_size(c.oid)), 0)
  into schema_bytes
  from pg_catalog.pg_class c
  where c.relnamespace = 'kovarboxd'::regnamespace and c.relkind = 'r';

  if schema_bytes >= 0.95 * 300 * 1024 * 1024 then
    return false;
  end if;

  update kovarboxd.people
  set biography = nullif(new_biography, ''),
      birthday = new_birthday,
      deathday = new_deathday,
      place_of_birth = nullif(new_place_of_birth, ''),
      details_fetched_at = now()
  where tmdb_id = person_id;

  return found;
end
$$;

revoke all on function kovarboxd.save_person_details(int, text, date, date, text) from public, anon, authenticated;
grant execute on function kovarboxd.save_person_details(int, text, date, date, text) to service_role;
