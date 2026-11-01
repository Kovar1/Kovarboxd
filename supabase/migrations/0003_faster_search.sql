-- Faster search functions. Measured as the anon role on 2026-10-31, repeat
-- runs: movie searches went from about 300 ms to 2 to 7 ms ("the", which
-- matches thousands of titles, 49 ms); people searches like "joe" from
-- 264 ms to 20 ms.
--
-- Three problems with the 0002 versions:
--
-- 1. Movies have an RLS policy with real conditions (removed_at, title), and
--    Postgres won't evaluate a non-leakproof operator such as @@ or the
--    trigram match before an RLS condition. So for the anon role neither
--    search index could be used. search_movies now runs as its owner
--    (security definer) and applies the same visibility filter itself.
--    search_path is empty, so every name it uses is schema-qualified.
--
-- 2. SQL functions are planned once without the query text, so Postgres
--    can't tell how selective a search is. These PL/pgSQL versions are
--    planned with the actual text on every call (force_custom_plan).
--
-- 3. Short people queries ("tom") share trigrams with tens of thousands of
--    names. People search now needs 3 characters, and for 3 or 4 characters
--    asks for a closer match (word similarity 0.8 instead of 0.5).

-- Same reason as in 0002: pg_trgm must be loaded before a function can pin
-- one of its settings.
select extensions.similarity('', '');

create or replace function kovarboxd.search_movies(q text, max_results int default 20)
returns table (
  tmdb_id int,
  title text,
  original_title text,
  release_year int,
  poster_path text,
  popularity real
)
language plpgsql
stable
security definer
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
set plan_cache_mode = force_custom_plan
as $$
declare
  nq text := lower(kovarboxd.f_unaccent(btrim(q)));
  terms text;
  tsq tsquery;
begin
  if length(nq) < 2 then
    return;
  end if;
  -- Every word as a prefix: "the godf" becomes 'the':* & 'godf':*
  select string_agg(quote_literal(w) || ':*', ' & ')
  into terms
  from unnest(regexp_split_to_array(nq, '[^[:alnum:]]+')) as w
  where w <> '';
  if terms is not null then
    tsq := to_tsquery('simple', terms);
  end if;

  return query
  select m.tmdb_id, m.title, m.original_title, m.release_year, m.poster_path, m.popularity
  from kovarboxd.movies m
  -- The same rows the "readable catalog movies" policy allows.
  where m.removed_at is null
    and m.title is not null
    and (m.search_tsv @@ tsq or nq operator(extensions.<%) lower(kovarboxd.f_unaccent(m.title)))
  order by
    (case
       when lower(kovarboxd.f_unaccent(m.title)) = nq then 3
       when m.search_tsv @@ tsq then 2
       else 1 + extensions.word_similarity(nq, lower(kovarboxd.f_unaccent(m.title)))
     end) * ln(2 + coalesce(m.popularity, 0)) desc,
    m.tmdb_id
  limit max_results;
end
$$;

create or replace function kovarboxd.search_people(q text, max_results int default 20)
returns table (
  tmdb_id int,
  name text,
  profile_path text,
  known_for_department text,
  popularity real
)
language plpgsql
stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
set plan_cache_mode = force_custom_plan
as $$
declare
  nq text := lower(kovarboxd.f_unaccent(btrim(q)));
begin
  if length(nq) < 3 then
    return;
  end if;
  if length(nq) <= 4 then
    -- Reverted when the function returns, because of the SET clause above.
    perform set_config('pg_trgm.word_similarity_threshold', '0.8', true);
  end if;

  return query
  select p.tmdb_id, p.name, p.profile_path, p.known_for_department, p.popularity
  from kovarboxd.people p
  where nq operator(extensions.<%) lower(kovarboxd.f_unaccent(p.name))
  order by
    extensions.word_similarity(nq, lower(kovarboxd.f_unaccent(p.name))) * ln(2 + coalesce(p.popularity, 0)) desc,
    p.tmdb_id
  limit max_results;
end
$$;

grant execute on function kovarboxd.search_movies(text, int) to anon, authenticated;
grant execute on function kovarboxd.search_people(text, int) to anon, authenticated;
