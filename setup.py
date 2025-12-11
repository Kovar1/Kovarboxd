"""
YoavBoxd Setup Script

Validates environment and prepares the application for first run.
Checks dependencies, database, and runs necessary migrations.
"""
import os
import sys
import sqlite3
import subprocess


def print_header(text):
    """Print formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def check_python_version():
    """Ensure Python 3.8+ is installed."""
    print_header("Checking Python Version")
    version = sys.version_info
    print(f"Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ ERROR: Python 3.8+ required")
        return False
    
    print("✅ Python version OK")
    return True


def check_dependencies():
    """Check if required packages are installed."""
    print_header("Checking Dependencies")
    
    required = ["flask", "pandas", "requests"]
    missing = []
    
    for package in required:
        try:
            __import__(package)
            print(f"✅ {package} installed")
        except ImportError:
            print(f"❌ {package} missing")
            missing.append(package)
    
    if missing:
        print("\n❌ Missing dependencies. Install with:")
        print("   pip install -r requirements.txt")
        return False
    
    print("\n✅ All dependencies installed")
    return True


def check_database():
    """Check if database exists and has required tables."""
    print_header("Checking Database")
    
    db_path = os.path.join("data", "imdb.db")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        print("\nYou need to:")
        print("1. Download IMDb datasets from https://datasets.imdbws.com/")
        print("2. Parse TSV files into SQLite format")
        print("3. Place database at data/imdb.db")
        print("\nRequired tables: title_basics, name_basics, title_principals,")
        print("                 title_ratings, title_crew")
        return False
    
    print(f"✅ Database found at {db_path}")
    
    # Check for required tables
    required_tables = [
        "title_basics",
        "name_basics", 
        "title_principals",
        "title_ratings",
        "title_crew"
    ]
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        missing_tables = [t for t in required_tables if t not in existing_tables]
        
        if missing_tables:
            print(f"❌ Missing required tables: {', '.join(missing_tables)}")
            conn.close()
            return False
        
        print("✅ All required tables present")
        
        # Check for FTS5 tables (optional but recommended)
        fts5_tables = ["title_basics_fts", "name_basics_fts"]
        has_fts5 = all(t in existing_tables for t in fts5_tables)
        
        if not has_fts5:
            print("⚠️  FTS5 tables not found (search will be slower)")
            print("   Run migrations to enable fast search:")
            print("   - python migrate_fts5_movies.py")
            print("   - python migrate_fts5_persons.py")
        else:
            print("✅ FTS5 tables present (fast search enabled)")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        return False


def check_tmdb_key():
    """Check if TMDb API key is configured."""
    print_header("Checking TMDb API Key")
    
    key = os.environ.get("TMDB_API_KEY")
    
    if not key:
        print("⚠️  TMDB_API_KEY environment variable not set")
        print("   Using fallback key from code (not recommended for production)")
        print("\n   To set your own key:")
        print("   PowerShell: $env:TMDB_API_KEY=\"your_key_here\"")
        print("   Bash:       export TMDB_API_KEY=\"your_key_here\"")
        print("\n   Get a free key at: https://www.themoviedb.org/settings/api")
        return True  # Not critical, fallback exists
    
    print(f"✅ TMDB_API_KEY configured ({key[:8]}...)")
    return True


def run_migrations():
    """Optionally run FTS5 migrations for better search performance."""
    print_header("Run FTS5 Migrations?")
    
    db_path = os.path.join("data", "imdb.db")
    
    if not os.path.exists(db_path):
        return True
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='title_basics_fts';")
        has_movie_fts = cursor.fetchone() is not None
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='name_basics_fts';")
        has_person_fts = cursor.fetchone() is not None
        conn.close()
        
        if has_movie_fts and has_person_fts:
            print("✅ FTS5 migrations already completed")
            return True
        
        print("\nFTS5 migrations not complete. Would you like to run them now?")
        print("(This enables faster search but may take several minutes)")
        choice = input("Run migrations? [y/N]: ").strip().lower()
        
        if choice != 'y':
            print("Skipping migrations (you can run them manually later)")
            return True
        
        if not has_movie_fts:
            print("\nRunning movie FTS5 migration...")
            subprocess.run([sys.executable, "migrate_fts5_movies.py"], check=True)
        
        if not has_person_fts:
            print("\nRunning person FTS5 migration...")
            subprocess.run([sys.executable, "migrate_fts5_persons.py"], check=True)
        
        print("\n✅ Migrations completed")
        return True
        
    except Exception as e:
        print(f"⚠️  Migration error: {e}")
        print("You can run migrations manually later")
        return True


def main():
    """Run all setup checks."""
    print("\n" + "=" * 60)
    print("  YoavBoxd Setup Validator")
    print("=" * 60)
    
    checks = [
        check_python_version(),
        check_dependencies(),
        check_database(),
        check_tmdb_key(),
    ]
    
    if all(checks):
        run_migrations()
        
        print_header("Setup Complete!")
        print("\n✅ All checks passed!")
        print("\nTo start the application:")
        print("   python app.py")
        print("\nThen visit: http://127.0.0.1:5000")
        return 0
    else:
        print_header("Setup Incomplete")
        print("\n❌ Please resolve the issues above before running the app")
        return 1


if __name__ == "__main__":
    sys.exit(main())
