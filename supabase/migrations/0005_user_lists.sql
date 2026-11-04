-- Per-user lists (Phase 3): what each person has seen and wants to see.
--
-- Named under the kovarboxd schema, so they never collide with AMC-Assistant's
-- public.watchlist, which holds AMC's own movie ids.
--
-- Deleting an account deletes its lists. A movie on someone's list can't be
-- deleted, which protects lists from any future catalog cleanup.

create table kovarboxd.seen (
  user_id    uuid not null references auth.users (id) on delete cascade,
  movie_id   integer not null references kovarboxd.movies (tmdb_id),
  seen_on    date,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table kovarboxd.watchlist (
  user_id    uuid not null references auth.users (id) on delete cascade,
  movie_id   integer not null references kovarboxd.movies (tmdb_id),
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create index seen_movie_idx on kovarboxd.seen (movie_id);
create index watchlist_movie_idx on kovarboxd.watchlist (movie_id);

-- Each person reads and writes only their own rows. The anon role gets nothing.
alter table kovarboxd.seen enable row level security;
alter table kovarboxd.watchlist enable row level security;

create policy "own seen rows" on kovarboxd.seen
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own watchlist rows" on kovarboxd.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on kovarboxd.seen, kovarboxd.watchlist to authenticated;
