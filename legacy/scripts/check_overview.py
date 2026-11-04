from db import conn, cursor

# Check schema
cursor.execute("PRAGMA table_info(tmdb_posters)")
cols = cursor.fetchall()
print("Columns:", cols)

# Check Top Gun data
cursor.execute("SELECT tconst, poster_url, overview FROM tmdb_posters WHERE tconst='tt0092099' LIMIT 1")
row = cursor.fetchone()
print("\nTop Gun data:", row)
