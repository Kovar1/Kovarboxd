YOAVBOXD — README

Overview
--------
YoavBoxd is a local Python application for exploring an offline IMDb dataset with a lightweight web UI and a small interactive console. It supports:
- Searching movies and people (actors/crew)
- Viewing movie details (cast + crew)
- Viewing a person's top movies
- Fetching and caching poster/profile image URLs via the TMDb API

This repository is designed to operate locally against a pre-built SQLite IMDb database (`data/imdb.db`).

Quick Start
-----------
1. Create and activate a Python environment (recommended):

	```powershell
	python -m venv .venv
	.\.venv\Scripts\Activate.ps1
	```

2. Install required packages:

	```powershell
	pip install -r requirements.txt
	```

	If you don't have a `requirements.txt`, install these packages manually:

	```powershell
	pip install flask pandas requests
	```

3. Ensure the IMDb SQLite file exists at `data/imdb.db` (this project expects a pre-populated database with IMDb tables).

4. (Optional but recommended) Provide a TMDb API key via an environment variable instead of leaving it in source code. In PowerShell:

	```powershell
	$env:TMDB_API_KEY="your_tmdb_api_key_here"
	```

5. Run the web app (default port 5000):

	```powershell
	python app.py
	```

	Or run the interactive console program:

	```powershell
	python Main.py
	```

Project Layout
--------------
- `app.py` — Flask web app that serves the HTML UI in `templates/` and wires routes to the search/detail functions.
- `Main.py` — Simple console-driven menu for terminal usage.
- `db.py` — Single shared SQLite connection and cursor used project-wide.
- `tmdb.py` — TMDb integration and caching helpers (poster/profile URL fetch + local cache tables).
- `search_movie.py` — Search logic and movie detail retrieval (returns `selected_df`, `actors_df`, `crew_df`).
- `search_person.py` — Person search and lookup (returns `person_df`, `movies_df`).
- `poster_cache_setup.py` — Helper script that ensures the poster cache table exists.
- `templates/` — HTML templates used by the Flask app.
- `data/imdb.db` — The required SQLite database (not included in repo). The app expects the following tables to exist: `title_basics`, `title_ratings`, `title_principals`, `name_basics`, `title_crew`. The project will create `tmdb_posters` and `tmdb_actor_images` cache tables automatically.

Important Notes
---------------
- Database: `db.py` opens a single global `sqlite3` connection (`conn`) with `check_same_thread=False`. Do not replace or duplicate this connection — use `db.conn` and `db.cursor` across modules.
- TMDb Key: The repository currently contains a TMDb key in `tmdb.py`. For security and portability, move the key into an environment variable and update `tmdb.py` to read `os.environ.get('TMDB_API_KEY')`. If you want, I can make that change for you.
- API Usage: All TMDb lookups should go through `tmdb.py` so poster/profile URL responses are cached in the database and duplicate external calls are avoided.
- Function Signatures: Keep the return signatures of the search functions unchanged unless you update the callers:
  - `search_movie(query, page=1)` → returns `(results_df, has_next_page)` for list searches; `get_movie_details(tconst)` → returns `(selected_df, actors_df, crew_df)`.
  - `search_person(query, page=1)` / `get_person_by_nconst(nconst)` → return `(person_df, movies_df)`.

Security & Privacy
------------------
- Never commit or share secret API keys in version control. Replace hard-coded keys with environment variables.

Suggested Improvements (optional)
--------------------------------
- Move TMDb key to environment variable and update `tmdb.py` to load it from `os.environ`.
- Add a `requirements.txt` file listing `flask`, `pandas`, `requests` (and specific versions) to simplify setup.
- Add unit tests for search functions that mock the DB connection and TMDb calls.
- Consider lazy-downloading posters to a local `static/` directory and serving them from the app (reduces remote calls at render time).

Troubleshooting
---------------
- If the app crashes on DB open, verify `data/imdb.db` exists and has the expected schema.
- If poster/profile images are missing, confirm you have a valid TMDb API key and that the database `tmdb_posters` table has entries (the app will create this table automatically).

Contact / Next Steps
--------------------
If you'd like, I can:
- Move the TMDb key to environment configuration and patch `tmdb.py` to read it.
- Create `requirements.txt` and a small `run.ps1` script to start the app with recommended settings.
- Add basic tests for the search modules.

Replace Log
-----------
- This file replaces the previous `readme.txt` and includes updated setup and run instructions.

End of README