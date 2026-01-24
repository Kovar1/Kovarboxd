# TMDb Data Project

Offline-friendly TMDb fetch + clean + Postgres load pipeline with a Flask UI (Kovarboxd) for searching movies and people.

## Prerequisites
- Python 3.11+
- Docker + Docker Compose (for PostgreSQL) or any reachable Postgres
- TMDB API key set as environment variable `TMDB_API_KEY`

## Setup
```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1  # PowerShell
pip install -r Kovarboxd/requirements.txt
```

## ETL Workflow
1) **Fetch full catalog**
```bash
python bulk_tmdb.py            # downloads in chunks/ using TMDB_API_KEY
```
2) **Curate dataset**
```bash
python clean.py                # writes tmdb_dump_YYYY-MM-DD.json
```
3) **Emit Postgres load script**
```bash
python json_to_postgres.py     # writes tmdb_dump_YYYY-MM-DD.sql
```
4) **Load into Postgres** (docker-compose default: kovar/kovar_pw@localhost:5432/kovarboxd)
```bash
docker compose up -d
Get-Content tmdb_dump_YYYY-MM-DD.sql | docker exec -i kovarboxd_db psql -U kovar -d kovarboxd
```
5) **Daily refresh (optional)**
```bash
python daily_tmdb.py           # uses date.txt window, writes a new tmdb_dump_*.json
```

## Using an existing dump (skip re-download)
If you already have a curated dump from another machine:
- Place your `tmdb_dump_YYYY-MM-DD.json` in the project root (or `db/`).
- To regenerate SQL from that JSON (no API calls):
	```bash
	python json_to_postgres.py   # reads latest tmdb_dump_*.json, writes matching .sql
	```
- To load straight from an existing `.sql` file, skip ETL and run step 4 above using that file.

## Sharing dumps between machines
- Dumps can be large; avoid committing them to git. Prefer one of:
	- Upload the JSON or SQL as a GitHub Release asset or to cloud storage, then download on the other PC.
	- If size is modest and you really need it in version control, use git LFS instead of normal git history.
- Once copied down, follow “Using an existing dump” to load without re-fetching.

## Run the web app (Flask UI)
```bash
cd Kovarboxd
$env:POSTGRES_DSN="postgresql+psycopg2://kovar:kovar_pw@localhost:5432/kovarboxd"
python app.py
```
Visit http://127.0.0.1:5000.

## Repository layout
- `bulk_tmdb.py`, `clean.py`, `json_to_postgres.py`, `daily_tmdb.py`: canonical ETL scripts
- `check_row.py`, `describe_sql.py`: inspection utilities
- `Kovarboxd/`: Flask search UI (templates + routes)
- Generated artifacts (ignored by git): `chunks/`, `backups/`, `tmdb_dump_*.json`, `tmdb_dump_*.sql`, `db/tmdb_dump_*`

## Notes
- Secrets are read from environment; no API keys are stored in source.
- Large data exports are intentionally ignored to keep the repo light.
