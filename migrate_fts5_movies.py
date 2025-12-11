"""
Migration script to create FTS5 virtual table for movie title search.

This enables:
- Fast full-text search (no table scans)
- Better fuzzy matching with ranking
- Porter stemming for better word matching

Run this once to set up the FTS5 infrastructure for movies.
"""

import sqlite3
import time

DB_PATH = "data/imdb.db"


def main():
    print("Connecting to database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # -------------------------
    # 1. Create FTS5 virtual table
    # -------------------------
    print("\nCreating FTS5 virtual table 'title_basics_fts'...")
    cursor.execute("DROP TABLE IF EXISTS title_basics_fts;")
    
    # FTS5 table with:
    # - tconst UNINDEXED (just for retrieval, not searchable)
    # - primaryTitle (movie title, searchable)
    # - startYear UNINDEXED (for ordering, not searchable)
    # - tokenize options: porter stemming + unicode61
    cursor.execute("""
        CREATE VIRTUAL TABLE title_basics_fts USING fts5(
            tconst UNINDEXED,
            primaryTitle,
            startYear UNINDEXED,
            tokenize='porter unicode61'
        );
    """)
    print("✓ FTS5 table created")

    # -------------------------
    # 2. Populate FTS5 table from title_basics (movies only)
    # -------------------------
    print("\nPopulating FTS5 table from title_basics (movies only)...")
    print("(This may take a few minutes for large datasets)")
    
    start = time.time()
    
    # Count movies only
    cursor.execute("SELECT COUNT(*) FROM title_basics WHERE titleType = 'movie';")
    total_rows = cursor.fetchone()[0]
    print(f"Total movie rows to process: {total_rows:,}")
    
    batch_size = 50000  # Larger batches for better performance
    offset = 0
    inserted = 0
    
    while True:
        cursor.execute("""
            SELECT tconst, primaryTitle, startYear
            FROM title_basics
            WHERE titleType = 'movie'
            LIMIT ? OFFSET ?;
        """, (batch_size, offset))
        
        batch = cursor.fetchall()
        if not batch:
            break
        
        # Insert batch into FTS5 table
        cursor.executemany("""
            INSERT INTO title_basics_fts (tconst, primaryTitle, startYear)
            VALUES (?, ?, ?);
        """, batch)
        
        inserted += len(batch)
        offset += batch_size
        
        # Commit every batch for better performance
        conn.commit()
        
        # Progress update every batch
        elapsed = time.time() - start
        rate = inserted / elapsed
        print(f"  Processed {inserted:,} rows ({inserted/total_rows*100:.1f}%) - {rate:.0f} rows/sec")
    
    elapsed = time.time() - start
    print(f"\n✓ FTS5 table populated with {inserted:,} rows in {elapsed:.1f}s")

    # -------------------------
    # 3. Verify FTS5 table
    # -------------------------
    print("\nVerifying FTS5 table...")
    
    # Test query: search for "godfather"
    test_query = "godfather"
    cursor.execute("""
        SELECT tconst, primaryTitle, startYear
        FROM title_basics_fts
        WHERE title_basics_fts MATCH ?
        ORDER BY rank
        LIMIT 5;
    """, (test_query,))
    
    results = cursor.fetchall()
    print(f"\nTest query: '{test_query}' found {len(results)} results:")
    for tconst, title, year in results:
        print(f"  {tconst}: {title} ({year})")
    
    # -------------------------
    # 4. Performance comparison
    # -------------------------
    print("\n" + "="*60)
    print("PERFORMANCE COMPARISON")
    print("="*60)
    
    # Old LIKE query
    start = time.time()
    cursor.execute("""
        SELECT b.tconst, b.primaryTitle, b.startYear
        FROM title_basics b
        LEFT JOIN title_ratings r ON b.tconst = r.tconst
        WHERE b.primaryTitle LIKE '%godfather%'
          AND b.titleType = 'movie'
        ORDER BY r.numVotes IS NULL, r.numVotes DESC
        LIMIT 100;
    """)
    like_results = cursor.fetchall()
    like_time = time.time() - start
    print(f"LIKE query:  {like_time*1000:.1f}ms ({len(like_results)} results)")
    
    # New FTS5 query (without ratings join for fair comparison)
    start = time.time()
    cursor.execute("""
        SELECT tconst, primaryTitle, startYear
        FROM title_basics_fts
        WHERE title_basics_fts MATCH 'godfather'
        ORDER BY rank
        LIMIT 100;
    """)
    fts_results = cursor.fetchall()
    fts_time = time.time() - start
    print(f"FTS5 query:  {fts_time*1000:.1f}ms ({len(fts_results)} results)")
    print(f"Speedup:     {like_time/fts_time:.1f}x faster")
    
    conn.close()
    
    print("\n" + "="*60)
    print("✓ Migration complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. The code has been updated to use FTS5 automatically")
    print("2. Test movie searches to see improved speed")
    print("3. Enjoy fast full-text search with relevance ranking!")


if __name__ == "__main__":
    main()
