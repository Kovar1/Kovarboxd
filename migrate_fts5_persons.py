"""
Migration script to create FTS5 virtual table for person name search.

This enables:
- Fast full-text search (no table scans)
- Accent-insensitive search (Skarsgård → skarsgard)
- Prefix and substring matching with ranking
- Porter stemming for better fuzzy matches

Run this once to set up the FTS5 infrastructure.
"""

import sqlite3
import unicodedata
import time

DB_PATH = "data/imdb.db"


def remove_accents(text: str) -> str:
    """Remove accent marks from text using Unicode normalization."""
    if not text:
        return text
    # NFD = decompose accented characters into base + combining marks
    # Category 'Mn' = Mark, Nonspacing (combining accent marks)
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )


def main():
    print("Connecting to database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # -------------------------
    # 1. Create FTS5 virtual table
    # -------------------------
    print("\nCreating FTS5 virtual table 'name_basics_fts'...")
    cursor.execute("DROP TABLE IF EXISTS name_basics_fts;")
    
    # FTS5 table with:
    # - nconst UNINDEXED (just for retrieval, not searchable)
    # - primaryName (original name, searchable)
    # - primaryName_norm (normalized name, searchable)
    # - tokenize options: porter stemming + unicode61 with diacritics removal
    cursor.execute("""
        CREATE VIRTUAL TABLE name_basics_fts USING fts5(
            nconst UNINDEXED,
            primaryName,
            primaryName_norm,
            tokenize='porter unicode61 remove_diacritics 1'
        );
    """)
    print("✓ FTS5 table created")

    # -------------------------
    # 2. Populate FTS5 table from name_basics
    # -------------------------
    print("\nPopulating FTS5 table from name_basics...")
    print("(This may take a few minutes for large datasets)")
    
    start = time.time()
    
    # Fetch all persons (in batches to avoid memory issues)
    cursor.execute("SELECT COUNT(*) FROM name_basics;")
    total_rows = cursor.fetchone()[0]
    print(f"Total rows to process: {total_rows:,}")
    
    batch_size = 50000  # Larger batches for better performance
    offset = 0
    inserted = 0
    
    while True:
        cursor.execute("""
            SELECT nconst, primaryName
            FROM name_basics
            LIMIT ? OFFSET ?;
        """, (batch_size, offset))
        
        batch = cursor.fetchall()
        if not batch:
            break
        
        # Prepare rows with normalized names
        rows_to_insert = []
        for nconst, primaryName in batch:
            primaryName_norm = remove_accents(primaryName).lower() if primaryName else ""
            rows_to_insert.append((nconst, primaryName, primaryName_norm))
        
        # Insert batch into FTS5 table
        cursor.executemany("""
            INSERT INTO name_basics_fts (nconst, primaryName, primaryName_norm)
            VALUES (?, ?, ?);
        """, rows_to_insert)
        
        inserted += len(rows_to_insert)
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
    
    # Test query: search for "skarsgard" (without accent)
    test_query = "skarsgard"
    cursor.execute("""
        SELECT nconst, primaryName
        FROM name_basics_fts
        WHERE name_basics_fts MATCH ?
        LIMIT 5;
    """, (test_query + '*',))
    
    results = cursor.fetchall()
    print(f"\nTest query: '{test_query}*' found {len(results)} results:")
    for nconst, name in results:
        print(f"  {nconst}: {name}")
    
    # -------------------------
    # 4. Performance comparison
    # -------------------------
    print("\n" + "="*60)
    print("PERFORMANCE COMPARISON")
    print("="*60)
    
    # Old LIKE query
    start = time.time()
    cursor.execute("""
        SELECT nconst, primaryName
        FROM name_basics
        WHERE primaryName LIKE '%skarsgard%'
        LIMIT 100;
    """)
    like_results = cursor.fetchall()
    like_time = time.time() - start
    print(f"LIKE query:  {like_time*1000:.1f}ms ({len(like_results)} results)")
    
    # New FTS5 query
    start = time.time()
    cursor.execute("""
        SELECT nconst, primaryName
        FROM name_basics_fts
        WHERE name_basics_fts MATCH 'skarsgard*'
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
    print("2. Test searches like 'skarsgard' (finds 'Skarsgård')")
    print("3. Enjoy fast, accent-insensitive search!")


if __name__ == "__main__":
    main()
