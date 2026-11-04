"""Live check of kovarboxd.my_insights against real catalog data.

Skips itself without SUPABASE_DB_URL. Acts as an existing user inside a
transaction that always rolls back, so it creates no accounts and saves nothing.
"""

import json
import os

import psycopg
import pytest

from pipeline import config  # noqa: F401  (loads .env)
from pipeline import db

pytestmark = pytest.mark.skipif(not os.environ.get("SUPABASE_DB_URL"), reason="needs SUPABASE_DB_URL")

GOODFELLAS, CASINO, IRISHMAN = 769, 524, 398978
SCORSESE, DE_NIRO, PESCI = 1032, 380, 4517


@pytest.fixture
def conn():
    with db.connect() as c:
        with c.transaction(force_rollback=True):
            yield c


def act_as(conn, user_id):
    conn.execute("reset role")
    conn.execute(
        "select set_config('request.jwt.claims', %s, true)",
        [json.dumps({"sub": user_id, "role": "authenticated"})],
    )
    conn.execute("set local role authenticated")


def users(conn):
    return [r[0] for r in conn.execute("select id::text from auth.users order by created_at limit 2").fetchall()]


def insights(conn):
    return conn.execute("select kovarboxd.my_insights()").fetchone()[0]


def test_numbers_for_three_scorsese_films(conn):
    me = users(conn)[0]
    act_as(conn, me)
    # Only this user's real rows could be here too, so start from a clean slate in this transaction.
    conn.execute("delete from kovarboxd.seen where user_id = %s", [me])
    conn.execute("delete from kovarboxd.watchlist where user_id = %s", [me])
    for movie in (GOODFELLAS, CASINO, IRISHMAN):
        conn.execute("insert into kovarboxd.seen (user_id, movie_id) values (%s, %s)", [me, movie])
    conn.execute("update kovarboxd.seen set seen_on = '2026-01-15' where user_id = %s and movie_id = %s", [me, CASINO])

    data = insights(conn)
    assert data["total"] == 3
    assert data["minutes"] > 400
    assert data["directors"][0] == {"id": SCORSESE, "label": "Martin Scorsese", "count": 3}
    assert {"id": DE_NIRO, "label": "Robert De Niro", "count": 3} in data["actors"]
    assert {b["label"]: b["count"] for b in data["by_decade"]} == {"1990s": 2, "2010s": 1}
    assert data["by_year_seen"] == [{"label": "2026", "count": 1}]
    assert any(g["label"] == "Crime" and g["count"] == 3 for g in data["genres"])
    pairs = {tuple(sorted(p["ids"])): p["count"] for p in data["pairs"]}
    assert pairs[tuple(sorted((SCORSESE, DE_NIRO)))] == 3
    assert pairs[tuple(sorted((DE_NIRO, PESCI)))] == 3


def test_empty_for_someone_with_nothing_seen(conn):
    me = users(conn)[0]
    act_as(conn, me)
    conn.execute("delete from kovarboxd.seen where user_id = %s", [me])
    conn.execute("delete from kovarboxd.watchlist where user_id = %s", [me])
    data = insights(conn)
    assert data["total"] == 0 and data["minutes"] == 0
    assert data["directors"] == [] and data["pairs"] == [] and data["by_decade"] == []


def test_only_counts_your_own_films(conn):
    me, other = users(conn)
    act_as(conn, other)
    conn.execute("delete from kovarboxd.seen where user_id = %s", [other])
    act_as(conn, me)
    conn.execute("insert into kovarboxd.seen (user_id, movie_id) values (%s, %s) on conflict do nothing", [me, GOODFELLAS])
    act_as(conn, other)
    assert insights(conn)["total"] == 0


def test_logged_out_visitors_cant_call_it(conn):
    conn.execute("set local role anon")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with conn.transaction():
            insights(conn)
