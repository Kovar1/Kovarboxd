import sqlite3
conn = sqlite3.connect(r'c:\Users\yoavi\OneDrive\Documents\YoavBoxd\data\imdb.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = [row[0] for row in cursor.fetchall()]

print('=== IMDb Tables ===')
for table in tables:
    cursor.execute(f'PRAGMA table_info({table});')
    cols = cursor.fetchall()
    col_count = len(cols)
    col_names = [c[1] for c in cols]
    print(f'\n{table} ({col_count} columns):')
    for col in col_names:
        print(f'  - {col}')
