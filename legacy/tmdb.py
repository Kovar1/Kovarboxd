import requests
import time
import os
from db import conn, cursor

# TMDb API key - reads from environment variable or prompts user
# Set with: $env:TMDB_API_KEY="your_key_here" (PowerShell) or export TMDB_API_KEY="your_key_here" (bash)
# Get a free key at: https://www.themoviedb.org/settings/api
TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")

if not TMDB_API_KEY:
    print("\n" + "=" * 60)
    print("  TMDb API Key Required")
    print("=" * 60)
    print("\nMovie posters and actor images require a TMDb API key.")
    print("Get a free key at: https://www.themoviedb.org/settings/api")
    print("\nOptions:")
    print("  1. Enter your API key now (temporary for this session)")
    print("  2. Press Enter to skip (app will work without images)")
    print("  3. Set permanently with: $env:TMDB_API_KEY=\"your_key\"")
    
    user_input = input("\nEnter TMDb API key (or press Enter to skip): ").strip()
    
    if user_input:
        TMDB_API_KEY = user_input
        print("✅ API key set for this session")
    else:
        print("⚠️  Running without TMDb API key - images will not load")
    print("=" * 60 + "\n")

# Global count of API calls
TMDB_API_CALLS = 0

# -------------------------------------------------------------------
# Create poster cache table (runs once)
# -------------------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS tmdb_posters (
    tconst TEXT PRIMARY KEY,
    poster_url TEXT,
    overview TEXT
);
""")
conn.commit()
print("[TMDB] tmdb_posters table ready.")

# Add overview column if it doesn't exist (migration)
try:
    cursor.execute("ALTER TABLE tmdb_posters ADD COLUMN overview TEXT;")
    conn.commit()
    print("[TMDB] Added overview column to tmdb_posters.")
except Exception as e:
    pass  # Column already exists

# -------------------------------------------------------------------
# Create actor image cache table (runs once)
# -------------------------------------------------------------------
cursor.execute("""
CREATE TABLE IF NOT EXISTS tmdb_actor_images (
    nconst TEXT PRIMARY KEY,
    profile_path TEXT
);
""")
conn.commit()
print("[TMDB] tmdb_actor_images table ready.")


# -------------------------------------------------------------------
# API call (external)
# -------------------------------------------------------------------
def get_tmdb_poster(tconst: str):
    global TMDB_API_CALLS
    TMDB_API_CALLS += 1

    start = time.time()
    url = (
        f"https://api.themoviedb.org/3/find/{tconst}"
        f"?api_key={TMDB_API_KEY}&external_source=imdb_id"
    )
    try:
        # short timeout to avoid hanging the web request
        response = requests.get(url, timeout=5)
    except requests.RequestException as exc:
        elapsed = time.time() - start
        print(f"[TMDB API ERROR] {tconst} → {elapsed:.3f}s  ({exc})")
        return None, None
    elapsed = time.time() - start

    # use ASCII arrow to avoid Windows encoding issues
    print(f"[TMDB API] {tconst} -> {elapsed:.3f}s  (call #{TMDB_API_CALLS})")

    if response.status_code != 200:
        print(f"[TMDB ERROR] HTTP {response.status_code}")
        return None, None

    data = response.json()
    results = data.get("movie_results", [])
    if not results:
        return None, None

    poster_path = results[0].get("poster_path")
    overview = results[0].get("overview", "")
    
    poster_url = None
    if poster_path:
        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}"

    return poster_url, overview


# -------------------------------------------------------------------
# Cache-aware poster fetch
# -------------------------------------------------------------------
def get_cached_poster(tconst: str):
    """Returns just the poster URL for backward compatibility."""
    row = cursor.execute(
        "SELECT poster_url FROM tmdb_posters WHERE tconst = ?",
        (tconst,)
    ).fetchone()

    # Cached
    if row and row[0]:
        print(f"[CACHE HIT] {tconst}")
        return row[0]

    print(f"[CACHE MISS] {tconst} -> calling TMDb")
    poster_url, overview = get_tmdb_poster(tconst)

    # Cache result
    cursor.execute(
        "INSERT OR REPLACE INTO tmdb_posters (tconst, poster_url, overview) VALUES (?, ?, ?)",
        (tconst, poster_url, overview)
    )
    conn.commit()

    return poster_url


def get_cached_movie_data(tconst: str):
    """Returns both poster URL and overview."""
    row = cursor.execute(
        "SELECT poster_url, overview FROM tmdb_posters WHERE tconst = ?",
        (tconst,)
    ).fetchone()

    # If cached and has overview, return it
    if row and row[0] and row[1]:
        print(f"[CACHE HIT movie data] {tconst}")
        return row[0], row[1]

    # If cached but missing overview, or not cached at all, fetch from API
    print(f"[CACHE MISS movie data] {tconst} -> calling TMDb")
    poster_url, overview = get_tmdb_poster(tconst)

    # Cache result
    cursor.execute(
        "INSERT OR REPLACE INTO tmdb_posters (tconst, poster_url, overview) VALUES (?, ?, ?)",
        (tconst, poster_url, overview)
    )
    conn.commit()

    return poster_url, overview


# -------------------------------------------------------------------
# API call for actor image (external)
# -------------------------------------------------------------------
def get_tmdb_actor_image(nconst: str):
    global TMDB_API_CALLS
    TMDB_API_CALLS += 1

    start = time.time()
    url = (
        f"https://api.themoviedb.org/3/find/{nconst}"
        f"?api_key={TMDB_API_KEY}&external_source=imdb_id"
    )
    try:
        response = requests.get(url, timeout=5)
    except requests.RequestException as exc:
        elapsed = time.time() - start
        print(f"[TMDB API ERROR] actor {nconst} → {elapsed:.3f}s  ({exc})")
        return None
    elapsed = time.time() - start

    # use ASCII arrow to avoid Windows encoding issues
    print(f"[TMDB API] actor {nconst} -> {elapsed:.3f}s  (call #{TMDB_API_CALLS})")

    if response.status_code != 200:
        print(f"[TMDB ERROR] HTTP {response.status_code}")
        return None

    data = response.json()
    results = data.get("person_results", [])
    if not results:
        return None

    profile_path = results[0].get("profile_path")
    if not profile_path:
        return None

    return f"https://image.tmdb.org/t/p/w500{profile_path}"


# -------------------------------------------------------------------
# Cache-aware actor image fetch
# -------------------------------------------------------------------
def get_cached_actor_image(nconst: str):
    row = cursor.execute(
        "SELECT profile_path FROM tmdb_actor_images WHERE nconst = ?",
        (nconst,)
    ).fetchone()

    # Cached
    if row and row[0]:
        # print(f"[CACHE HIT actor] {nconst}")
        return row[0]

    # print(f"[CACHE MISS actor] {nconst} → calling TMDb")
    profile_url = get_tmdb_actor_image(nconst)

    # Cache result
    cursor.execute(
        "INSERT OR REPLACE INTO tmdb_actor_images (nconst, profile_path) VALUES (?, ?)",
        (nconst, profile_url)
    )
    conn.commit()

    return profile_url
