import gzip
import json

from pipeline import exports

LINES = [
    {"adult": False, "id": 1, "original_title": "Popular", "popularity": 50.0, "video": False},
    {"adult": False, "id": 2, "original_title": "Obscure", "popularity": 0.6, "video": False},
    {"adult": True, "id": 3, "original_title": "Adult", "popularity": 90.0, "video": False},
    {"adult": False, "id": 4, "original_title": "Video", "popularity": 80.0, "video": True},
    {"adult": False, "id": 5, "original_title": "Exactly at cutoff", "popularity": 10.0, "video": False},
    {"adult": False, "id": 6, "original_title": "No popularity", "video": False},
]


def write_export(tmp_path, lines):
    path = tmp_path / "movie_ids.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")
        f.write("\n")  # trailing blank line, which real exports sometimes have
    return path


def test_iter_export_reads_every_line(tmp_path):
    path = write_export(tmp_path, LINES)
    assert [e["id"] for e in exports.iter_export(path)] == [1, 2, 3, 4, 5, 6]


def test_keep_drops_adult_video_and_unpopular():
    kept = [e["id"] for e in LINES if exports.keep(e, cutoff=10)]
    assert kept == [1, 5]


def test_movies_above_returns_id_popularity_pairs(tmp_path):
    path = write_export(tmp_path, LINES)
    assert exports.movies_above(exports.iter_export(path), 10) == [(1, 50.0), (5, 10.0)]


def test_scan_export_splits_stored_and_new():
    # 3 is stored but now flagged adult: it still counts as present on TMDb.
    scan = exports.scan_export(iter(LINES), cutoff=10, stored_ids={2, 3})
    assert scan.lines == 6
    assert scan.stored_popularity == {2: 0.6, 3: 90.0}
    assert scan.new == [(1, 50.0), (5, 10.0)]


def test_export_url_format():
    from datetime import date
    assert exports.export_url(date(2026, 1, 5)) == (
        "https://files.tmdb.org/p/exports/movie_ids_01_05_2026.json.gz"
    )
