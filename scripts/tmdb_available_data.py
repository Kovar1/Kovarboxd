import requests
import json

TMDB_API_KEY = '85157fd687373ec6ae64b5aa60149b1f'

print("=== Testing TMDb Movie API ===")
# Test with a popular movie - The Dark Knight (tt0468569)
movie_id = 'tt0468569'
url = f'https://api.themoviedb.org/3/find/{movie_id}?api_key={TMDB_API_KEY}&external_source=imdb_id'
r = requests.get(url, timeout=5)
data = r.json()

if data.get('movie_results'):
    movie = data['movie_results'][0]
    print("\nMovie data available:")
    for key in sorted(movie.keys()):
        val = movie[key]
        if isinstance(val, str) and len(val) > 80:
            print(f"  {key}: {val[:80]}...")
        elif isinstance(val, list) and len(val) > 0:
            print(f"  {key}: [{len(val)} items] {val[:2] if len(val) > 2 else val}")
        else:
            print(f"  {key}: {val}")

print("\n=== Testing TMDb Person API ===")
# Test with Emma Stone (nm1297015)
person_id = 'nm1297015'
url = f'https://api.themoviedb.org/3/find/{person_id}?api_key={TMDB_API_KEY}&external_source=imdb_id'
r = requests.get(url, timeout=5)
data = r.json()

if data.get('person_results'):
    person = data['person_results'][0]
    print("\nPerson data available:")
    for key in sorted(person.keys()):
        val = person[key]
        if isinstance(val, str) and len(val) > 80:
            print(f"  {key}: {val[:80]}...")
        elif isinstance(val, list) and len(val) > 0:
            print(f"  {key}: [{len(val)} items] Example: {val[0].get('title', val[0].get('name', '?')) if isinstance(val[0], dict) else val[0]}")
        else:
            print(f"  {key}: {val}")

print("\n=== What we're currently using ===")
print("Movies: poster_path only")
print("People: profile_path only")
