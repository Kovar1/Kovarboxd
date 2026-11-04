-- Insights: numbers about what the logged-in person has seen.
--
-- Runs with the caller's own permissions, and the seen table's RLS limits it to
-- their rows. Logged-out visitors can't call it.
--
-- "pairs" looks only at the top 10 billed cast and directors of each film, so
-- it finds real collaborations instead of every combination of bit parts.

create or replace function kovarboxd.my_insights()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with films as (
    select m.tmdb_id, m.release_year, m.runtime, s.seen_on
    from kovarboxd.seen s
    join kovarboxd.movies m on m.tmdb_id = s.movie_id
    where s.user_id = (select auth.uid())
  ),
  people as (
    select distinct c.movie_id, c.person_id, c.kind, c.job, c.cast_order
    from kovarboxd.credits c
    join films f on f.tmdb_id = c.movie_id
  ),
  names as (
    select p.tmdb_id, p.name from kovarboxd.people p
    where p.tmdb_id in (select person_id from people)
  ),
  key_people as (
    select distinct movie_id, person_id from people
    where job = 'Director' or (kind = 'cast' and cast_order < 10)
  ),
  pairs as (
    select a.person_id as a, b.person_id as b, count(*) as films
    from key_people a
    join key_people b on a.movie_id = b.movie_id and a.person_id < b.person_id
    group by 1, 2
    having count(*) >= 2
    order by films desc, a, b
    limit 10
  )
  select jsonb_build_object(
    'total', (select count(*) from films),
    'minutes', (select coalesce(sum(runtime), 0) from films),
    'watchlist', (select count(*) from kovarboxd.watchlist where user_id = (select auth.uid())),
    'by_decade', coalesce((
      select jsonb_agg(jsonb_build_object('label', d.decade || 's', 'count', d.n) order by d.decade)
      from (
        select release_year / 10 * 10 as decade, count(*) as n
        from films where release_year is not null group by 1
      ) d
    ), '[]'::jsonb),
    'by_year_seen', coalesce((
      select jsonb_agg(jsonb_build_object('label', y.year::text, 'count', y.n) order by y.year)
      from (
        select extract(year from seen_on)::int as year, count(*) as n
        from films where seen_on is not null group by 1
      ) y
    ), '[]'::jsonb),
    'genres', coalesce((
      select jsonb_agg(jsonb_build_object('label', g.name, 'count', g.n) order by g.n desc, g.name)
      from (
        select ge.name, count(*) as n
        from kovarboxd.movie_genres mg
        join films f on f.tmdb_id = mg.movie_id
        join kovarboxd.genres ge on ge.id = mg.genre_id
        group by 1 order by 2 desc, 1 limit 10
      ) g
    ), '[]'::jsonb),
    'directors', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.person_id, 'label', n.name, 'count', t.n) order by t.n desc, n.name)
      from (
        select person_id, count(distinct movie_id) as n
        from people where job = 'Director' group by 1 order by 2 desc, 1 limit 10
      ) t join names n on n.tmdb_id = t.person_id
    ), '[]'::jsonb),
    'actors', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.person_id, 'label', n.name, 'count', t.n) order by t.n desc, n.name)
      from (
        select person_id, count(distinct movie_id) as n
        from people where kind = 'cast' group by 1 order by 2 desc, 1 limit 10
      ) t join names n on n.tmdb_id = t.person_id
    ), '[]'::jsonb),
    'pairs', coalesce((
      select jsonb_agg(
        jsonb_build_object('ids', jsonb_build_array(p.a, p.b), 'label', na.name || ' + ' || nb.name, 'count', p.films)
        order by p.films desc, na.name, nb.name
      )
      from pairs p
      join kovarboxd.people na on na.tmdb_id = p.a
      join kovarboxd.people nb on nb.tmdb_id = p.b
    ), '[]'::jsonb)
  )
$$;

revoke all on function kovarboxd.my_insights() from public, anon;
grant execute on function kovarboxd.my_insights() to authenticated;
