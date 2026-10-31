import json
from datetime import date
from pathlib import Path

import pytest

from pipeline import config, tmdb

FIXTURES = Path(__file__).parent / "fixtures"


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def fight_club():
    return load("movie_550.json")


@pytest.fixture
def goodfellas():
    return load("movie_769.json")


# Credit trimming ----------------------------------------------------------------

def test_trim_keeps_top_billed_cast_in_order(goodfellas):
    cast, _ = tmdb.trim_credits(goodfellas["credits"])
    assert len(goodfellas["credits"]["cast"]) > config.MAX_CAST
    assert len(cast) == config.MAX_CAST
    orders = [c["order"] for c in cast]
    assert orders == sorted(orders)
    assert orders[0] == 0
    assert cast[0]["name"] == "Robert De Niro"


def test_trim_sorts_cast_even_if_api_order_is_shuffled(goodfellas):
    shuffled = {"cast": list(reversed(goodfellas["credits"]["cast"])), "crew": []}
    cast, _ = tmdb.trim_credits(shuffled)
    assert [c["order"] for c in cast] == list(range(config.MAX_CAST))


def test_trim_keeps_only_listed_crew_jobs(fight_club):
    _, crew = tmdb.trim_credits(fight_club["credits"])
    assert crew
    assert {c["job"] for c in crew} <= config.CREW_JOBS
    assert len(crew) < len(fight_club["credits"]["crew"])
    assert ("David Fincher", "Director") in {(c["name"], c["job"]) for c in crew}


def test_trim_limits_are_configurable(fight_club):
    cast, crew = tmdb.trim_credits(fight_club["credits"], max_cast=3, crew_jobs={"Director"})
    assert len(cast) == 3
    assert [c["name"] for c in crew] == ["David Fincher"]


def test_trim_handles_missing_credits():
    assert tmdb.trim_credits({}) == ([], [])


# API response to rows -------------------------------------------------------------

def test_movie_row(fight_club):
    movie = tmdb.to_rows(fight_club)["movie"]
    assert movie["tmdb_id"] == 550
    assert movie["imdb_id"] == "tt0137523"
    assert movie["title"] == "Fight Club"
    assert movie["release_date"] == date(1999, 10, 15)
    assert movie["runtime"] == 139
    assert movie["budget"] == 63000000
    assert set(movie) == {
        "tmdb_id", "imdb_id", "title", "original_title", "original_language", "release_date",
        "runtime", "overview", "tagline", "poster_path", "backdrop_path", "popularity",
        "vote_average", "vote_count", "budget", "revenue", "status",
    }


def test_empty_strings_and_zeroes_become_null(fight_club):
    data = dict(fight_club, release_date="", tagline="", imdb_id=None, budget=0, revenue=0, runtime=0)
    movie = tmdb.to_rows(data)["movie"]
    assert movie["release_date"] is None
    assert movie["tagline"] is None
    assert movie["imdb_id"] is None
    assert movie["budget"] is None and movie["revenue"] is None and movie["runtime"] is None


def test_genre_rows(fight_club):
    rows = tmdb.to_rows(fight_club)
    assert {"id": 18, "name": "Drama"} in rows["genres"]
    assert {(r["movie_id"], r["genre_id"]) for r in rows["movie_genres"]} == {
        (550, g["id"]) for g in fight_club["genres"]
    }


def test_duplicate_genres_are_dropped(fight_club):
    # Seen in the wild on movie 78565, which lists Drama twice.
    data = dict(fight_club, genres=[{"id": 18, "name": "Drama"}, {"id": 18, "name": "Drama"}])
    rows = tmdb.to_rows(data)
    assert rows["genres"] == [{"id": 18, "name": "Drama"}]
    assert rows["movie_genres"] == [{"movie_id": 550, "genre_id": 18}]


def test_people_are_unique_and_sorted(goodfellas):
    people = tmdb.to_rows(goodfellas)["people"]
    ids = [p["tmdb_id"] for p in people]
    assert ids == sorted(set(ids))
    scorsese = next(p for p in people if p["name"] == "Martin Scorsese")
    assert scorsese["known_for_department"] == "Directing"


def test_credit_rows(goodfellas):
    rows = tmdb.to_rows(goodfellas)
    credits = rows["credits"]
    cast = [c for c in credits if c["kind"] == "cast"]
    crew = [c for c in credits if c["kind"] == "crew"]
    assert len(cast) == config.MAX_CAST
    assert all(c["movie_id"] == 769 for c in credits)
    assert len({c["credit_id"] for c in credits}) == len(credits)
    # Every credit points at a person row.
    assert {c["person_id"] for c in credits} <= {p["tmdb_id"] for p in rows["people"]}

    de_niro = next(c for c in cast if c["cast_order"] == 0)
    assert de_niro["character"] == "James Conway"
    assert de_niro["job"] is None and de_niro["department"] is None

    director = next(c for c in crew if c["job"] == "Director")
    assert director["department"] == "Directing"
    assert director["character"] is None and director["cast_order"] is None


def test_credit_counts(goodfellas):
    raw_cast, raw_crew, kept_cast, kept_crew = tmdb.credit_counts(goodfellas)
    assert raw_cast == len(goodfellas["credits"]["cast"])
    assert raw_crew == len(goodfellas["credits"]["crew"])
    assert kept_cast == config.MAX_CAST
    assert 0 < kept_crew < raw_crew
