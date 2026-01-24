import json
import os
import requests
from datetime import date, datetime
from pathlib import Path

# TMDB API key is provided via environment to keep secrets out of source.
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
if not TMDB_API_KEY:
    raise RuntimeError("Set TMDB_API_KEY environment variable before running clean.py")

TMDB_API = requests.Session()
TMDB_API.params = {"api_key": TMDB_API_KEY}
#   are "Adult",
#   runtime is less than 1 hr,
#   don't have a poster,
#   don't have any votes

def scrub_chunks():
    """Collate a list of chunk paths into a single dictionary

    Keyword arguments:
    files -- list of paths to g-zipped chunks from `tmdb.py`
    """
    files = glob.glob('chunks/*')
    if len(files) == 0 :
        raise SystemExit("No chunks found in `chunks/`. Did you run `tmdb.py` already?")

    keep = dict()

    for f in files:
        with gzip.open(f, "r") as zip_ref:
            movies = json.load(zip_ref)
            for m in movies.keys():
                dat = movies[m]
                if ( not dat["adult"] and
                    dat["vote_count"] > 5 and
                    dat["budget"] > 1 and
                    dat["original_language"] == "en" and
                    dat["poster_path"] is not None and
                    dat["runtime"] is not None and
                    dat["runtime"] > 59 and
                    dat["release_date"] 
                    ):
                    k = dat["id"]
                    keep.update({k : dat})
    return keep

if __name__ == "__main__":
    keep = scrub_chunks()
    filename = "tmdb_dump_" + str(date.today()) + ".json"
    with open(filename, "w") as f:
        json.dump(keep, f)