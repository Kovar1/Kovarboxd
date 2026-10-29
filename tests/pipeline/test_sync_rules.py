from datetime import date, datetime, timezone

from pipeline import config, sync


def test_first_sync_uses_tmdb_default_window():
    assert sync.changes_window(None, date(2026, 10, 30)) == (None, None)


def test_changes_since_last_good_sync():
    last = datetime(2026, 10, 27, 9, 17, tzinfo=timezone.utc)
    assert sync.changes_window(last, date(2026, 10, 30)) == (date(2026, 10, 27), date(2026, 10, 30))


def test_changes_window_is_capped():
    last = datetime(2026, 9, 1, tzinfo=timezone.utc)
    start, end = sync.changes_window(last, date(2026, 10, 30))
    assert (end - start).days == config.CHANGES_MAX_DAYS


def test_find_removals():
    stored = {1: False, 2: False, 3: True, 4: True}
    present = {1, 3}
    missing, returned = sync.find_removals(stored, present)
    assert missing == [2]
    assert returned == [3]
