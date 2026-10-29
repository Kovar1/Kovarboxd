"""Apply SQL files from supabase/migrations that haven't been applied yet.

Files run in name order, each in its own transaction, and are recorded in
kovarboxd.schema_migrations.

    python -m pipeline.migrate
"""

import sys

from pipeline import config, db

BOOTSTRAP = """
create schema if not exists kovarboxd;
create table if not exists kovarboxd.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
alter table kovarboxd.schema_migrations enable row level security;
"""


def pending_files(applied):
    files = sorted(config.MIGRATIONS_DIR.glob("*.sql"))
    return [f for f in files if f.name not in applied]


def main():
    conn = db.connect()
    conn.execute(BOOTSTRAP)
    applied = {r[0] for r in conn.execute("select version from kovarboxd.schema_migrations")}
    todo = pending_files(applied)
    if not todo:
        print("Nothing to apply, the schema is up to date.")
    for path in todo:
        print(f"Applying {path.name}")
        with conn.transaction():
            # No parameters, so psycopg sends the file as one simple query and
            # several statements per file are fine.
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("insert into kovarboxd.schema_migrations (version) values (%s)", [path.name])
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
