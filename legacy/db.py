import sqlite3
import os

# Base directory of this project (YoavBoxd/)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Path to data/imdb.db
DB_PATH = os.path.join(BASE_DIR, "data", "imdb.db")

# Ensure data directory exists (doesn't recreate DB, just ensures folder)
os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)

# Single global connection, thread-safe for Flask
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

print(f"Connected to IMDb database at: {DB_PATH}")
