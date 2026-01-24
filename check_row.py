import json
from pathlib import Path

movies = json.loads(Path('tmdb_dump_2026-01-19.json').read_text())
count = 0
for m in movies.values():
    count += 1
    if count == 13652:
        print('Movie', count)
        print('ID:', m.get('id'))
        print('Title:', m.get('title')[:100] if m.get('title') else None)
        overview = m.get('overview', '')
        print('Overview has newline?', '\n' in overview)
        print('Overview:', repr(overview[:200]))
        break
