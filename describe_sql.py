import csv
from pathlib import Path
from typing import Dict, List, Iterable, Tuple

SQL_PATH = Path(__file__).resolve().parent / "tmdb_dump_2026-01-02.sql"
TABLE_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "movies": {
        "movie_id": "TMDB movie id (primary key).",
        "title": "Movie title (localized).",
        "original_language": "ISO 639-1 original language code.",
        "release_date": "Release date (YYYY-MM-DD).",
        "runtime": "Runtime in minutes.",
        "adult": "Adult flag (true/false).",
        "budget": "Reported budget in USD (may be 0).",
        "revenue": "Reported revenue in USD (may be 0).",
        "vote_average": "TMDB average rating (0-10 scale).",
        "vote_count": "Number of TMDB votes.",
        "genres": "Array of genre objects as JSONB.",
        "poster_path": "Relative poster path on TMDB.",
        "overview": "Plot synopsis text.",
    },
    "cast": {
        "movie_id": "Foreign key to movies.movie_id.",
        "person_id": "TMDB person id for the cast member.",
        "name": "Cast member name.",
        "character": "Character name.",
        "gender": "Gender code from TMDB (0/1/2).",
        "order_in_cast": "Billing order as provided by TMDB.",
    },
    "directors": {
        "movie_id": "Foreign key to movies.movie_id.",
        "person_id": "TMDB person id for the director.",
        "name": "Director name.",
    },
    "crew": {
        "movie_id": "Foreign key to movies.movie_id.",
        "person_id": "TMDB person id for the crew member.",
        "name": "Crew member name.",
        "job": "Job title (e.g., Director, Producer, Editor).",
        "department": "Crew department (e.g., Directing, Production).",
        "gender": "Gender code from TMDB (0/1/2).",
    },
}


def read_copy_blocks(path: Path) -> Iterable[Tuple[str, List[str], Iterable[List[str]]]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = iter(f)
        for line in reader:
            line = line.rstrip("\n")
            if line.startswith("COPY ") and " FROM STDIN WITH CSV;" in line:
                header = line[len("COPY ") : -len(" FROM STDIN WITH CSV;")]
                table, cols_part = header.split(" ", 1)
                cols_str = cols_part.strip()[1:-1]  # remove surrounding parentheses
                columns = [c.strip() for c in cols_str.split(",")]
                rows: List[List[str]] = []
                for row_line in reader:
                    row_line = row_line.rstrip("\n")
                    if row_line == "\\.":
                        break
                    row = next(csv.reader([row_line]))
                    rows.append(row)
                yield table, columns, rows


def explain_table(table: str, columns: List[str]) -> None:
    print(f"\nTable: {table}")
    descriptions = TABLE_DESCRIPTIONS.get(table, {})
    for col in columns:
        desc = descriptions.get(col, "(no description available)")
        print(f"  - {col}: {desc}")


def show_examples(table: str, columns: List[str], rows: List[List[str]], limit: int = 5) -> None:
    print(f"Example rows (up to {limit}):")
    for row in rows[:limit]:
        pairs = [f"{col}={val}" for col, val in zip(columns, row)]
        print("  " + "; ".join(pairs))


def main() -> None:
    if not SQL_PATH.exists():
        raise FileNotFoundError(
            f"Expected SQL file at {SQL_PATH}. Run json_to_postgres.py first."
        )

    for table, columns, rows in read_copy_blocks(SQL_PATH):
        explain_table(table, columns)
        show_examples(table, columns, rows)


if __name__ == "__main__":
    main()
