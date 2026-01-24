# REVERT INSTRUCTIONS

If fuzzy search causes issues, follow these steps:

## 1. Revert search_movie.py

Replace the WHERE clause and ORDER BY in search_movies() function:

```python
# REVERT TO:
WHERE m.title ILIKE %(pattern)s
ORDER BY COALESCE(m.vote_count, 0) DESC, m.title

# Remove from SELECT:
levenshtein(LOWER(m.title), LOWER(%(query)s)) as distance

# Remove from params:
"query": query,
```

## 2. Revert search_person.py

Replace the WHERE clause and ORDER BY in search_persons() function:

```python
# REVERT TO:
WHERE name ILIKE %(pattern)s
ORDER BY name

# Remove from SELECT:
levenshtein(LOWER(name), LOWER(%(query)s)) as distance

# Remove from params:
"query": query,
```

## 3. Test Steps

After implementing:
1. Run: `docker exec -i kovarboxd_db psql -U kovar -d kovarboxd < enable_fuzzy_search.sql`
2. Test search with typo: "Tom Cruse" should find "Tom Cruise"
3. If too slow or giving bad results, revert using instructions above

## Performance Notes

If searches become slow:
- Consider adding WHERE clause limit: `AND levenshtein(...) <= 3` 
- Reduce tolerance from 3 to 2
- Or fully revert to ILIKE only
