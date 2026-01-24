import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Any


MovieDict = Dict[str, Any]


def load_movies(path: Path) -> Dict[str, MovieDict]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_date(value: Any) -> str:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def normalize_bool(value: Any) -> str:
    if value is None:
        return None
    return "true" if bool(value) else "false"


def iter_movie_rows(movies: Dict[str, MovieDict]) -> Iterable[List[Any]]:
    for movie in movies.values():
        release_date = normalize_date(movie.get("release_date"))
        genres = json.dumps(movie.get("genres", []), ensure_ascii=True)
        overview = movie.get("overview") or ""
        # Escape newlines and carriage returns in text fields
        overview = overview.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
        yield [
            movie.get("id"),
            movie.get("title"),
            movie.get("original_language"),
            release_date,
            movie.get("runtime"),
            normalize_bool(movie.get("adult")),
            movie.get("budget"),
            movie.get("revenue"),
            movie.get("vote_average"),
            movie.get("vote_count"),
            genres,
            movie.get("poster_path"),
            overview,
        ]


def iter_cast_rows(movies: Dict[str, MovieDict]) -> Iterable[List[Any]]:
    for movie in movies.values():
        movie_id = movie.get("id")
        for cast_member in movie.get("cast", []) or []:
            yield [
                movie_id,
                cast_member.get("id"),
                cast_member.get("name"),
                cast_member.get("character"),
                cast_member.get("gender"),
                cast_member.get("order"),
                cast_member.get("profile_path"),
            ]


def iter_director_rows(movies: Dict[str, MovieDict]) -> Iterable[List[Any]]:
    for movie in movies.values():
        movie_id = movie.get("id")
        for director in movie.get("directors", []) or []:
            yield [movie_id, director.get("id"), director.get("name")]


def iter_crew_rows(movies: Dict[str, MovieDict]) -> Iterable[List[Any]]:
    for movie in movies.values():
        movie_id = movie.get("id")
        crew_list = movie.get("crew")

        # If full crew list is absent, fall back to directors so they are still represented.
        if not crew_list:
            crew_list = movie.get("directors", []) or []

        for member in crew_list:
            yield [
                movie_id,
                member.get("id"),
                member.get("name"),
                member.get("job"),
                member.get("department"),
                member.get("gender"),
                member.get("profile_path"),
            ]


def escape_copy_value(v: Any) -> str:
    """Escape a value for PostgreSQL COPY format."""
    if v is None:
        return "\\N"
    s = str(v)
    # Escape backslash first
    s = s.replace("\\", "\\\\")
    # Escape newline, tab, carriage return
    s = s.replace("\n", "\\n")
    s = s.replace("\t", "\\t")
    s = s.replace("\r", "\\r")
    return s


def write_copy_block(
    file_handle,
    table_name: str,
    columns: List[str],
    rows: Iterable[List[Any]],
) -> None:
    file_handle.write(f"\\copy {table_name} ({', '.join(columns)}) FROM STDIN;\n")
    for row in rows:
        escaped_row = [escape_copy_value(v) for v in row]
        file_handle.write("\t".join(escaped_row) + "\n")
    file_handle.write("\\.\n\n")


def build_sql(output: Path, movies: Dict[str, MovieDict]) -> None:
    with output.open("w", encoding="utf-8", newline="") as f:
        f.write("BEGIN;\n\n")
        f.write(
            """
CREATE TABLE IF NOT EXISTS movies (
    movie_id INTEGER PRIMARY KEY,
    title TEXT,
    original_language TEXT,
    release_date DATE,
    runtime INTEGER,
    adult BOOLEAN,
    budget BIGINT,
    revenue BIGINT,
    vote_average DOUBLE PRECISION,
    vote_count INTEGER,
    genres JSONB,
    poster_path TEXT,
    overview TEXT
);

CREATE TABLE IF NOT EXISTS movie_cast (
    movie_id INTEGER REFERENCES movies(movie_id),
    person_id INTEGER,
    name TEXT,
    character TEXT,
    gender INTEGER,
    order_in_cast INTEGER,
    profile_path TEXT
);

CREATE TABLE IF NOT EXISTS directors (
    movie_id INTEGER REFERENCES movies(movie_id),
    person_id INTEGER,
    name TEXT
);

CREATE TABLE IF NOT EXISTS crew (
    movie_id INTEGER REFERENCES movies(movie_id),
    person_id INTEGER,
    name TEXT,
    job TEXT,
    department TEXT,
    gender INTEGER,
    profile_path TEXT
);

"""
        )
        write_copy_block(
            f,
            "movies",
            [
                "movie_id",
                "title",
                "original_language",
                "release_date",
                "runtime",
                "adult",
                "budget",
                "revenue",
                "vote_average",
                "vote_count",
                "genres",
                "poster_path",
                "overview",
            ],
            iter_movie_rows(movies),
        )
        write_copy_block(
            f,
            "movie_cast",
            [
                "movie_id",
                "person_id",
                "name",
                "character",
                "gender",
                "order_in_cast",
                "profile_path",
            ],
            iter_cast_rows(movies),
        )
        write_copy_block(
            f,
            "directors",
            ["movie_id", "person_id", "name"],
            iter_director_rows(movies),
        )
        write_copy_block(
            f,
            "crew",
            [
                "movie_id",
                "person_id",
                "name",
                "job",
                "department",
                "gender",
                "profile_path",
            ],
            iter_crew_rows(movies),
        )
        f.write("COMMIT;\n")


BASE_DIR = Path(__file__).resolve().parent


def find_latest_dump(base_dir: Path) -> Path:
    """Return the most recently modified tmdb_dump_*.json in base_dir."""
    dumps = list(base_dir.glob("tmdb_dump_*.json"))
    if not dumps:
        raise FileNotFoundError(
            f"No tmdb_dump_*.json found in {base_dir}. Generate one with clean.py first."
        )
    return max(dumps, key=lambda p: p.stat().st_mtime)


DEFAULT_INPUT = find_latest_dump(BASE_DIR)
DEFAULT_OUTPUT = DEFAULT_INPUT.with_suffix(".sql")


def main() -> None:
    input_path = DEFAULT_INPUT
    output_path = DEFAULT_OUTPUT

    movies = load_movies(input_path)
    build_sql(output_path, movies)
    print(f"Wrote PostgreSQL load script to {output_path}")


if __name__ == "__main__":
    main()
