# Kovarboxd

A local Python web application for exploring an offline IMDb dataset with a fast, modern UI. Search for movies, actors, and filmographies with poster images and metadata from TMDb.

![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![Flask](https://img.shields.io/badge/flask-3.0-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Features

- **Movie Search** - Fast full-text search across millions of movies
- **Person Search** - Find actors, directors, and crew members
- **Multi-Person Search** - Discover films featuring multiple people
- **Visual Interface** - Movie posters and actor profile images via TMDb
- **FTS5 Search** - Lightning-fast search with ranking and accent-insensitive matching
- **Smart Caching** - Minimal API calls with local database caching
- **Responsive Design** - Clean HTML templates for desktop and mobile

## Quick Start

### Prerequisites

- Python 3.8 or higher
- IMDb dataset (see [Database Setup](#database-setup))
- TMDb API key (free from [themoviedb.org](https://www.themoviedb.org/settings/api))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kovar1/Kovarboxd.git
   cd Kovarboxd
   ```

2. **Create a virtual environment** (recommended)
   ```powershell
   # Windows PowerShell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   ```bash
   # macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up TMDb API key**
   
   Get a free API key from [TMDb](https://www.themoviedb.org/settings/api), then:
   
   ```powershell
   # Windows PowerShell
   $env:TMDB_API_KEY="your_api_key_here"
   ```
   ```bash
   # macOS/Linux
   export TMDB_API_KEY="your_api_key_here"
   ```

5. **Run setup validation**
   ```bash
   python setup.py
   ```
   
   This will check your environment, database, and optionally run FTS5 migrations for faster search.

6. **Start the application**
   ```bash
   python app.py
   ```
   
   Visit **http://127.0.0.1:5000** in your browser.

## Database Setup

Kovarboxd requires a local SQLite database built from IMDb's public datasets.

### Option 1: Download Pre-Built Database (Recommended)

If available, download `imdb.db` and place it in the `data/` folder:
```
Kovarboxd/
└── data/
    └── imdb.db
```

### Option 2: Build from IMDb Datasets

1. **Download IMDb datasets** from [https://datasets.imdbws.com/](https://datasets.imdbws.com/):
   - `title.basics.tsv.gz`
   - `name.basics.tsv.gz`
   - `title.principals.tsv.gz`
   - `title.ratings.tsv.gz`
   - `title.crew.tsv.gz`

2. **Parse and import into SQLite**
   
   Use a tool like [imdb-sqlite](https://github.com/alberanid/imdbpy) or write custom scripts to:
   - Extract TSV files
   - Create tables: `title_basics`, `name_basics`, `title_principals`, `title_ratings`, `title_crew`
   - Import data into `data/imdb.db`

3. **Run FTS5 migrations** for fast search (optional but recommended):
   ```bash
   python migrate_fts5_movies.py
   python migrate_fts5_persons.py
   ```

### Required Database Tables

| Table | Description |
|-------|-------------|
| `title_basics` | Movie metadata (title, year, type) |
| `name_basics` | Person names and birth/death years |
| `title_principals` | Cast and crew associations |
| `title_ratings` | User ratings and vote counts |
| `title_crew` | Directors and writers |

### Optional Tables (Auto-Created)

| Table | Description |
|-------|-------------|
| `tmdb_posters` | Cached movie posters and overviews |
| `tmdb_actor_images` | Cached actor profile images |
| `title_basics_fts` | Full-text search index for movies |
| `name_basics_fts` | Full-text search index for people |

## Project Structure

```
Kovarboxd/
├── app.py                      # Flask web application (main entry point)
├── Main.py                     # CLI interface (legacy, optional)
├── db.py                       # Database connection singleton
├── tmdb.py                     # TMDb API integration & caching
├── search_movie.py             # Movie search logic
├── search_person.py            # Single person search
├── search_people.py            # Multi-person intersection search
├── migrate_fts5_movies.py      # FTS5 setup for movies
├── migrate_fts5_persons.py     # FTS5 setup for people
├── setup.py                    # Environment validation script
├── requirements.txt            # Python dependencies
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── data/
│   └── imdb.db                 # SQLite database (user-provided)
├── templates/                  # HTML templates
│   ├── home.html
│   ├── movie_search.html
│   ├── movie_results.html
│   ├── movie_details.html
│   ├── person_search.html
│   ├── person_results.html
│   ├── person_details.html
│   ├── people_search.html
│   ├── people_confirm.html
│   └── people_results.html
└── scripts/                    # Utility & debugging scripts
    ├── inspect_schema.py
    ├── check_overview.py
    ├── test_tmdb_api.py
    └── ...
```

## Usage

### Web Interface

1. **Search for Movies**
   - Navigate to `/movie`
   - Enter a movie title
   - View results with posters, cast, and crew

2. **Search for a Person**
   - Navigate to `/person`
   - Enter an actor or director name
   - Browse their filmography sorted by popularity

3. **Multi-Person Search**
   - Navigate to `/people`
   - Enter up to 3 names
   - Find films featuring all specified people

### CLI Interface (Optional)

Run the legacy terminal interface:
```bash
python Main.py
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | Your TMDb API key | Fallback hardcoded key (not recommended) |

### Flask Settings

Edit `app.py` to customize:
- **Debug mode**: `app.run(debug=True)` (line 405)
- **Port**: `app.run(port=5000)` (default 5000)
- **Host**: `app.run(host='0.0.0.0')` (expose to network)

## Performance

### FTS5 Full-Text Search

For optimal performance, run the FTS5 migrations:
```bash
python migrate_fts5_movies.py
python migrate_fts5_persons.py
```

**Benefits:**
- ⚡ 10-100x faster search queries
- 🎯 Ranked results by relevance
- 🌐 Accent-insensitive matching (Skarsgård → skarsgard)
- 📝 Porter stemming for fuzzy matches

Without FTS5, the app falls back to slower `LIKE` queries.

## Troubleshooting

### "ImportError: No module named 'flask'"
```bash
pip install -r requirements.txt
```

### "Database not found at data/imdb.db"
Follow the [Database Setup](#database-setup) section to obtain or build the database.

### "No results found" / Slow searches
Run FTS5 migrations for faster, better search:
```bash
python migrate_fts5_movies.py
python migrate_fts5_persons.py
```

### TMDb images not loading
1. Verify your API key is set: `echo $env:TMDB_API_KEY`
2. Check internet connectivity
3. View API call logs in console output

### Flask won't start
- Ensure port 5000 is not in use
- Check `db.py` can access `data/imdb.db`
- Run `python setup.py` to validate environment

## Development

### Adding Features

1. **New search function**: Add to `search_*.py` modules
2. **New route**: Edit `app.py` and create template in `templates/`
3. **Database changes**: Create migration script (follow `migrate_fts5_*.py` pattern)

### Code Notes

- `db.py` opens one shared SQLite connection (`check_same_thread=False`) for the whole app. Import `conn` from `db` instead of opening new connections.
- All TMDb lookups go through `tmdb.py`, which caches poster and profile URLs in the database (`tmdb_posters`, `tmdb_actor_images`) so repeat API calls are avoided.
- The search functions return pandas DataFrames. Keep these return shapes unless you also update the callers in `app.py`:
  - `search_movies(query, page=1)` returns `(results_df, has_next_page)`
  - `get_movie_details(tconst)` returns `(selected_df, actors_df, crew_df)`
  - `search_person(query)` and `get_person_by_nconst(nconst)` return `(person_df, movies_df)`

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-flask

# Run tests (if test suite exists)
pytest
```

### Code Style

- Follow PEP 8 conventions
- Use `black` for formatting: `black *.py`
- Type hints encouraged for new code

## Security Notes

⚠️ **Important:**
- Never commit API keys to version control
- Always use environment variables for secrets
- The database may contain public IMDb data - respect their [licensing terms](https://www.imdb.com/interfaces/)
- This is a local application - do not expose directly to the internet without authentication

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Credits

- **Data Source**: [IMDb Datasets](https://www.imdb.com/interfaces/)
- **Images**: [The Movie Database (TMDb)](https://www.themoviedb.org/)
- **Built with**: Flask, Pandas, SQLite FTS5

## Roadmap

- [ ] User authentication for multi-user support
- [ ] Watchlist and favorites
- [ ] Advanced filtering (genre, year range, rating)
- [ ] Export search results to CSV
- [ ] Recommendation engine

---
