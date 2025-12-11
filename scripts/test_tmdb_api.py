import requests
import json

TMDB_API_KEY = '85157fd687373ec6ae64b5aa60149b1f'

# Test with Emma Stone nconst (nm1297015)
test_nconst = 'nm1297015'
url = f'https://api.themoviedb.org/3/find/{test_nconst}?api_key={TMDB_API_KEY}&external_source=imdb_id'
print(f'Testing TMDb API for {test_nconst}')
print(f'URL: {url}')
try:
    r = requests.get(url, timeout=5)
    print(f'Status: {r.status_code}')
    data = r.json()
    print(f'Response keys: {list(data.keys())}')
    if 'person_results' in data:
        person_results = data['person_results']
        print(f'Person results count: {len(person_results)}')
        if person_results:
            person = person_results[0]
            print(f'First result keys: {list(person.keys())}')
            profile_path = person.get('profile_path')
            print(f'Profile path: {profile_path}')
            if profile_path:
                full_url = f'https://image.tmdb.org/t/p/w500{profile_path}'
                print(f'Full URL: {full_url}')
    else:
        print(f'Full response: {json.dumps(data, indent=2)[:500]}')
except Exception as e:
    print(f'Error: {e}')
