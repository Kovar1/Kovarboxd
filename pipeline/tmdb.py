"""TMDb API client, plus the functions that turn API responses into table rows."""

import logging
import os
import threading
import time
from datetime import date

import requests

from pipeline import config

log = logging.getLogger(__name__)


class TmdbError(Exception):
    pass


class RateLimiter:
    """Spaces requests evenly across all threads, and pauses everyone on a 429."""

    def __init__(self, per_second):
        self.interval = 1.0 / per_second
        self._lock = threading.Lock()
        self._next = 0.0
        self._paused_until = 0.0

    def wait(self):
        with self._lock:
            now = time.monotonic()
            slot = max(now, self._next, self._paused_until)
            self._next = slot + self.interval
        if slot > now:
            time.sleep(slot - now)

    def pause(self, seconds):
        with self._lock:
            self._paused_until = max(self._paused_until, time.monotonic() + seconds)


class TmdbClient:
    def __init__(self, token=None, per_second=config.REQUESTS_PER_SECOND):
        token = token or os.environ.get("TMDB_API_TOKEN")
        if not token:
            raise SystemExit("TMDB_API_TOKEN is not set. Add it to .env or the environment.")
        self._headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        self._limiter = RateLimiter(per_second)
        self._local = threading.local()
        self._count_lock = threading.Lock()
        self.calls = 0

    def _session(self):
        # requests.Session isn't guaranteed thread safe, so each thread gets its own.
        session = getattr(self._local, "session", None)
        if session is None:
            session = requests.Session()
            session.headers.update(self._headers)
            self._local.session = session
        return session

    def _count(self):
        with self._count_lock:
            self.calls += 1

    def get(self, path, params=None):
        """GET a v3 endpoint. Returns parsed JSON, or None on 404."""
        url = config.TMDB_API_BASE + path
        problem = None
        for attempt in range(config.MAX_RETRIES + 1):
            self._limiter.wait()
            self._count()
            try:
                resp = self._session().get(url, params=params, timeout=config.HTTP_TIMEOUT_SECONDS)
            except (requests.Timeout, requests.ConnectionError) as exc:
                problem = f"{type(exc).__name__}: {exc}"
            else:
                if resp.status_code == 200:
                    return resp.json()
                if resp.status_code == 404:
                    return None
                if resp.status_code == 429:
                    wait = _retry_after_seconds(resp)
                    log.warning("TMDb rate limit hit, pausing all requests for %.1fs", wait)
                    self._limiter.pause(wait)
                    problem = "HTTP 429"
                    continue
                if resp.status_code < 500:
                    raise TmdbError(f"GET {path} returned HTTP {resp.status_code}: {resp.text[:200]}")
                problem = f"HTTP {resp.status_code}"
            if attempt < config.MAX_RETRIES:
                time.sleep(config.BACKOFF_SECONDS * 2 ** attempt)
        raise TmdbError(f"GET {path} failed after {config.MAX_RETRIES + 1} tries: {problem}")

    def movie(self, tmdb_id):
        return self.get(f"/movie/{tmdb_id}", {"append_to_response": "credits"})

    def changed_movie_ids(self, start_date=None, end_date=None):
        """IDs from /movie/changes. With no dates TMDb covers the past 24 hours."""
        params = {}
        if start_date:
            params["start_date"] = start_date.isoformat()
        if end_date:
            params["end_date"] = end_date.isoformat()
        ids = set()
        page, total_pages = 1, 1
        while page <= total_pages:
            data = self.get("/movie/changes", {**params, "page": page}) or {}
            ids.update(item["id"] for item in data.get("results", []))
            total_pages = data.get("total_pages", 0)
            page += 1
        return ids


def _retry_after_seconds(resp):
    try:
        return max(float(resp.headers.get("Retry-After", "")), 1.0)
    except ValueError:
        return 10.0


# Turning API responses into rows ----------------------------------------------

def trim_credits(credits, max_cast=config.MAX_CAST, crew_jobs=config.CREW_JOBS):
    """Keep the top billed cast and the crew jobs we care about."""
    cast = sorted(credits.get("cast", []), key=lambda c: c.get("order", 10**6))[:max_cast]
    crew = [c for c in credits.get("crew", []) if c.get("job") in crew_jobs]
    return cast, crew


def _date_or_none(value):
    return date.fromisoformat(value) if value else None


def _text_or_none(value):
    return value if value else None


def to_rows(data):
    """Turn one /movie/{id}?append_to_response=credits response into table rows."""
    movie_id = data["id"]
    movie = {
        "tmdb_id": movie_id,
        "imdb_id": _text_or_none(data.get("imdb_id")),
        "title": data.get("title"),
        "original_title": data.get("original_title"),
        "original_language": _text_or_none(data.get("original_language")),
        "release_date": _date_or_none(data.get("release_date")),
        "runtime": data.get("runtime") or None,
        "overview": _text_or_none(data.get("overview")),
        "tagline": _text_or_none(data.get("tagline")),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "popularity": data.get("popularity"),
        "vote_average": data.get("vote_average"),
        "vote_count": data.get("vote_count"),
        "budget": data.get("budget") or None,
        "revenue": data.get("revenue") or None,
        "status": _text_or_none(data.get("status")),
    }

    genres = [{"id": g["id"], "name": g["name"]} for g in data.get("genres", [])]
    movie_genres = [{"movie_id": movie_id, "genre_id": g["id"]} for g in genres]

    cast, crew = trim_credits(data.get("credits", {}))
    people = {}
    credits = {}
    for kind, entries in (("cast", cast), ("crew", crew)):
        for c in entries:
            people.setdefault(c["id"], {
                "tmdb_id": c["id"],
                "name": c.get("name") or "",
                "profile_path": c.get("profile_path"),
                "known_for_department": _text_or_none(c.get("known_for_department")),
                "gender": c.get("gender"),
                "popularity": c.get("popularity"),
            })
            credits.setdefault(c["credit_id"], {
                "credit_id": c["credit_id"],
                "movie_id": movie_id,
                "person_id": c["id"],
                "kind": kind,
                "character": _text_or_none(c.get("character")) if kind == "cast" else None,
                "cast_order": c.get("order") if kind == "cast" else None,
                "department": c.get("department") if kind == "crew" else None,
                "job": c.get("job") if kind == "crew" else None,
            })

    return {
        "movie": movie,
        "genres": sorted(genres, key=lambda g: g["id"]),
        "movie_genres": movie_genres,
        "people": sorted(people.values(), key=lambda p: p["tmdb_id"]),
        "credits": list(credits.values()),
    }


def credit_counts(data):
    """(raw cast, raw crew, kept cast, kept crew) for the trimming report."""
    credits = data.get("credits", {})
    cast, crew = trim_credits(credits)
    return len(credits.get("cast", [])), len(credits.get("crew", [])), len(cast), len(crew)
