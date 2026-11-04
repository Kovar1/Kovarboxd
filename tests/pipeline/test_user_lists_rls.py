"""Live check that seen and watchlist rows are private to their owner.

Runs against the real database when SUPABASE_DB_URL is set, and skips itself
otherwise (for example in CI). It acts as two existing users inside a
transaction that always rolls back, so it creates no accounts and saves nothing.
"""

import json
import os

import psycopg
import pytest

from pipeline import config  # noqa: F401  (loads .env)
from pipeline import db

pytestmark = pytest.mark.skipif(not os.environ.get("SUPABASE_DB_URL"), reason="needs SUPABASE_DB_URL")

GOODFELLAS = 769
TABLES = ["seen", "watchlist"]


@pytest.fixture
def conn():
    with db.connect() as c:
        with c.transaction(force_rollback=True):
            yield c


@pytest.fixture
def two_users(conn):
    rows = conn.execute("select id::text from auth.users order by created_at limit 2").fetchall()
    if len(rows) < 2:
        pytest.skip("needs two accounts")
    return rows[0][0], rows[1][0]


def act_as(conn, user_id):
    conn.execute("reset role")
    conn.execute(
        "select set_config('request.jwt.claims', %s, true)",
        [json.dumps({"sub": user_id, "role": "authenticated"})],
    )
    conn.execute("set local role authenticated")


def act_as_anon(conn):
    conn.execute("reset role")
    conn.execute("select set_config('request.jwt.claims', '', true)")
    conn.execute("set local role anon")


@pytest.mark.parametrize("table", TABLES)
def test_owner_can_write_and_read_their_rows(conn, two_users, table):
    me, _ = two_users
    act_as(conn, me)
    conn.execute(f"insert into kovarboxd.{table} (user_id, movie_id) values (%s, %s)", [me, GOODFELLAS])
    rows = conn.execute(f"select movie_id from kovarboxd.{table} where movie_id = %s", [GOODFELLAS]).fetchall()
    assert rows == [(GOODFELLAS,)]


@pytest.mark.parametrize("table", TABLES)
def test_other_people_cant_see_change_or_delete_them(conn, two_users, table):
    me, other = two_users
    act_as(conn, me)
    conn.execute(f"insert into kovarboxd.{table} (user_id, movie_id) values (%s, %s)", [me, GOODFELLAS])

    act_as(conn, other)
    # Only the other user's own rows are visible, so never a row owned by me.
    assert conn.execute(f"select count(*) from kovarboxd.{table} where user_id = %s", [me]).fetchone()[0] == 0
    assert conn.execute(f"delete from kovarboxd.{table} where user_id = %s", [me]).rowcount == 0
    assert conn.execute(f"update kovarboxd.{table} set created_at = now() where user_id = %s", [me]).rowcount == 0

    act_as(conn, me)
    # Only this row: the account may have real rows of its own.
    assert conn.execute(f"select count(*) from kovarboxd.{table} where user_id = %s and movie_id = %s", [me, GOODFELLAS]).fetchone()[0] == 1


@pytest.mark.parametrize("table", TABLES)
def test_nobody_can_add_rows_for_someone_else(conn, two_users, table):
    me, other = two_users
    act_as(conn, other)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with conn.transaction():
            conn.execute(f"insert into kovarboxd.{table} (user_id, movie_id) values (%s, %s)", [me, GOODFELLAS])


@pytest.mark.parametrize("table", TABLES)
def test_logged_out_visitors_get_nothing(conn, table):
    act_as_anon(conn)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with conn.transaction():
            conn.execute(f"select * from kovarboxd.{table}")
