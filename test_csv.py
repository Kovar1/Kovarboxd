import csv
from pathlib import Path
import json
import io

# Load the JSON
movies = json.loads(Path('tmdb_dump_2026-01-19.json').read_text())
count = 0
for m in movies.values():
    count += 1
    if count == 13652:
        overview = m.get('overview', '')
        print('=== ORIGINAL DATA ===')
        print('Has literal newline in overview?', '\n' in overview)
        print('Overview (first 150 chars):', repr(overview[:150]))
        
        print('\n=== PYTHON CSV.WRITER OUTPUT ===')
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL, escapechar='\\')
        writer.writerow([str(m.get('id')), m.get('title'), overview])
        
        line = output.getvalue()
        print('Output has escaped newline (\\\\n)?', '\\n' in line)
        print('Output has literal newline?', '\n' in line[:-1])  # Skip trailing newline
        print('Output length:', len(line))
        print('Output (first 200 chars):', repr(line[:200]))
        break
