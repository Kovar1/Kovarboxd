import json
import os
import requests
from datetime import date, datetime
from pathlib import Path

# TMDB API key is provided via environment to keep secrets out of source.
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
if not TMDB_API_KEY:
    raise RuntimeError("Set TMDB_API_KEY environment variable before running daily_tmdb.py")

TMDB_API = requests.Session()
TMDB_API.params = {"api_key": TMDB_API_KEY}

BASE_DIR = Path(__file__).resolve().parent
DATE_FILE = BASE_DIR / "date.txt"
JSON_FILE = BASE_DIR / "tmdb_dump_2026-01-02.json"


def read_start_date() -> str:
    """Read start_date from date.txt"""
    if not DATE_FILE.exists():
        raise FileNotFoundError(f"Expected {DATE_FILE}. Create it with a date like 2026-01-01")
    with DATE_FILE.open("r") as f:
        return f.read().strip()


def write_current_date() -> None:
    """Update date.txt to today's date"""
    with DATE_FILE.open("w") as f:
        f.write(str(date.today()))


def get_changed_movie_ids(start_date: str, end_date: str) -> list:
    """Fetch all movie IDs changed between start_date and end_date"""
    all_ids = []
    page = 1
    while True:
        response = TMDB_API.get(
            "https://api.themoviedb.org/3/movie/changes",
            params={"start_date": start_date, "end_date": end_date, "page": page},
        )
        data = response.json()
        if response.status_code != 200:
            print(f"Error: {data}")
            break
        
        results = data.get("results", [])
        if not results:
            break
        
        for result in results:
            all_ids.append(result["id"])
        
        page += 1
    
    return all_ids


def fetch_movie(movie_id: int) -> dict:
    """Fetch fresh movie data from TMDB API"""
    response = TMDB_API.get(f"https://api.themoviedb.org/3/movie/{movie_id}")
    if response.status_code == 200:
        movie = response.json()
        # Fetch credits too
        credits_response = TMDB_API.get(
            f"https://api.themoviedb.org/3/movie/{movie_id}/credits"
        )
        if credits_response.status_code == 200:
            credits = credits_response.json()
            movie["cast"] = credits.get("cast", [])
            crew = credits.get("crew", [])
            movie["directors"] = [c for c in crew if c["job"] == "Director"]
            movie["crew"] = crew
        return movie
    return None


def update_json_file(changed_ids: list) -> int:
    """Load JSON, update changed movies, save back. Returns count of updates."""
    if not JSON_FILE.exists():
        raise FileNotFoundError(f"Expected {JSON_FILE}. Run json_to_postgres.py first.")
    
    with JSON_FILE.open("r", encoding="utf-8") as f:
        movies = json.load(f)
    
    updated_count = 0
    for movie_id in changed_ids:
        movie_data = fetch_movie(movie_id)
        if movie_data:
            movies[str(movie_id)] = movie_data
            updated_count += 1
            print(f"Updated movie {movie_id}: {movie_data.get('title', 'Unknown')}")
        else:
            print(f"Failed to fetch movie {movie_id}")
    
    with JSON_FILE.open("w", encoding="utf-8") as f:
        json.dump(movies, f)
    
    return updated_count


def main() -> None:
    start_date_str = read_start_date()
    end_date_str = str(date.today())
    
    if start_date_str == end_date_str:
        print(f"No new day since last run ({start_date_str}). Skipping.")
        return
    
    print(f"Fetching movies changed between {start_date_str} and {end_date_str}...")
    changed_ids = get_changed_movie_ids(start_date_str, end_date_str)
    
    if not changed_ids:
        print("No movies changed in this period.")
        write_current_date()
        return
    
    print(f"Found {len(changed_ids)} changed movie IDs. Updating...")
    updated = update_json_file(changed_ids)
    print(f"Updated {updated} movies in {JSON_FILE}")
    
    write_current_date()
    print(f"Updated date.txt to {date.today()}")


if __name__ == "__main__":
    main()
