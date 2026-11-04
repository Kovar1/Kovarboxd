-- Make nightly popularity updates cheap.
--
-- movies_pending_idx had popularity as its key, so changing popularity counted
-- as changing an indexed column. Postgres then can't do a HOT (in-place)
-- update: every update rewrote the row and all its index entries, including
-- the search indexes. Measured on 2026-11-02: 184,640 updates, 0 HOT, and the
-- movies table doubled in three nights.
--
-- The pending list is short, so it can be sorted when it's read. Keying the
-- index on tmdb_id lets popularity updates be HOT.

create index movies_pending_id_idx on kovarboxd.movies (tmdb_id)
  where details_fetched_at is null and removed_at is null;

drop index kovarboxd.movies_pending_idx;
