"""
Kovarboxd - Movie & Person Search Web Application

A Flask web application for exploring movie data with actor/director filmographies.
Connects to a PostgreSQL database containing TMDb movie data.
"""

from flask import Flask, request, render_template, redirect, url_for, jsonify
from sqlalchemy import text

# Import database engine and utilities
from db import engine, _mask_dsn, _build_dsn

# Import search functions
from search_movie import search_movies, get_movie_details
from search_person import search_persons, get_person_by_id, get_person_candidates
from search_people import (
    get_candidates_for_names,
    search_films_by_person_ids,
    get_person_name_by_id,
)

# =============================================================================
# Flask Application Setup
# =============================================================================

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True


# =============================================================================
# Startup Checks
# =============================================================================

def check_database_ready() -> bool:
    """
    Verify database connection and required tables exist.
    
    Returns:
        True if database is ready, raises RuntimeError otherwise.
    """
    try:
        with engine.begin() as conn:
            # Test basic connectivity
            conn.execute(text("SELECT 1"))
            
            # Check for required tables
            result = conn.execute(
                text("""
                    SELECT tablename
                    FROM pg_catalog.pg_tables
                    WHERE schemaname = 'public'
                      AND tablename IN ('movies', 'movie_cast', 'directors', 'crew')
                """)
            ).fetchall()
            
            found_tables = {row[0] for row in result}
            required_tables = {"movies", "movie_cast", "directors", "crew"}
            missing = required_tables - found_tables
            
            if missing:
                raise RuntimeError(
                    f"Missing required tables: {', '.join(sorted(missing))}. "
                    "Please load the database schema."
                )
        
        print("[app.py] Database readiness check passed")
        return True
        
    except Exception as exc:
        dsn = _build_dsn()
        masked_dsn = _mask_dsn(dsn)
        print(f"\n[ERROR] Database check failed!")
        print(f"  DSN: {masked_dsn}")
        print(f"  Error: {exc}")
        print("\n  To fix:")
        print("  1. Start PostgreSQL: docker compose up -d")
        print("  2. Load schema: Get-Content db/tmdb_dump_2026-01-02.sql | docker exec -i kovarboxd_db psql -U kovar -d kovarboxd")
        raise


# Run check at startup
check_database_ready()


# =============================================================================
# Routes: Home
# =============================================================================

@app.route("/")
def home():
    """Home page with navigation to search features."""
    return render_template("home.html")


# =============================================================================
# Routes: Movie Search
# =============================================================================

@app.route("/api/autocomplete/movie")
def autocomplete_movie():
    """
    Movie autocomplete API endpoint.
    Returns JSON array of up to 3 movie suggestions.
    """
    query = request.args.get("q", "").strip()
    if not query or len(query) < 2:
        return jsonify([])
    
    results_df, _ = search_movies(query, page=1, per_page=3)
    
    if results_df.empty:
        return jsonify([])
    
    suggestions = [
        {
            "id": row["tconst"],
            "title": row["primaryTitle"],
            "year": row["startYear"] if row["startYear"] else ""
        }
        for _, row in results_df.iterrows()
    ]
    
    return jsonify(suggestions)


@app.route("/movie")
def movie_search():
    """
    Movie search page and results.
    
    Query params:
        q: Search query (optional - shows search form if empty)
        page: Page number for pagination (default: 1)
    """
    query = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)
    
    # No query - show search form
    if not query:
        return render_template("movie_search.html")
    
    # Perform search
    results_df, has_next_page = search_movies(query, page=page)
    
    # No results
    if results_df.empty:
        return render_template(
            "movie_results.html",
            movies=[],
            query=query,
            page=page,
            has_next_page=False,
        )
    
    movies = results_df.to_dict(orient="records")
    
    # Single result - go directly to details
    if len(movies) == 1 and page == 1:
        return redirect(url_for("movie_details", movie_id=movies[0]["tconst"]))
    
    return render_template(
        "movie_results.html",
        movies=movies,
        query=query,
        page=page,
        has_next_page=has_next_page,
    )


@app.route("/movie/<int:movie_id>")
def movie_details(movie_id: int):
    """
    Movie details page showing cast and crew.
    
    URL params:
        movie_id: The movie's database ID
    """
    movie, actors, crew = get_movie_details(movie_id)
    
    if movie is None:
        return render_template("movie_results.html", movies=[], query="", page=1, has_next_page=False)
    
    return render_template(
        "movie_details.html",
        movie=movie,
        actors=actors,
        crew=crew,
    )


# =============================================================================
# Routes: Person Search
# =============================================================================

@app.route("/api/autocomplete/person")
def autocomplete_person():
    """
    Person autocomplete API endpoint.
    Returns JSON array of up to 3 person suggestions.
    """
    query = request.args.get("q", "").strip()
    if not query or len(query) < 2:
        return jsonify([])
    
    results_df, _ = search_persons(query, page=1, per_page=3)
    
    if results_df.empty:
        return jsonify([])
    
    suggestions = [
        {
            "id": row["nconst"],
            "name": row["primaryName"]
        }
        for _, row in results_df.iterrows()
    ]
    
    return jsonify(suggestions)


@app.route("/person")
def person_search():
    """
    Person search page and results.
    
    Query params:
        q: Search query (optional - shows search form if empty)
        page: Page number for pagination (default: 1)
    """
    query = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)
    
    # No query - show search form
    if not query:
        return render_template("person_search.html")
    
    # Perform search
    results_df, has_next_page = search_persons(query, page=page)
    
    # No results
    if results_df.empty:
        return render_template(
            "person_results.html",
            persons=[],
            query=query,
            page=page,
            has_next_page=False,
        )
    
    persons = results_df.to_dict(orient="records")
    
    # Single result - go directly to details
    if len(persons) == 1 and page == 1:
        return redirect(url_for("person_details", person_id=persons[0]["nconst"]))
    
    return render_template(
        "person_results.html",
        persons=persons,
        query=query,
        page=page,
        has_next_page=has_next_page,
    )


@app.route("/person/<int:person_id>")
def person_details(person_id: int):
    """
    Person details page showing filmography grouped by role.
    
    URL params:
        person_id: The person's database ID
    """
    person, categories, movies_by_category = get_person_by_id(person_id)
    
    if person is None:
        return render_template("person_results.html", persons=[], query="", page=1, has_next_page=False)
    
    return render_template(
        "person_details.html",
        person=person,
        categories=categories,
        movies_by_category=movies_by_category,
    )


# =============================================================================
# Routes: Multi-Person Search (Films by People)
# =============================================================================

@app.route("/people")
def people_search():
    """
    Multi-person search - find films featuring multiple people.
    
    Flow:
    1. Initial: Show search form (people_search.html)
    2. Names submitted: Show confirmation with candidate matches (people_confirm.html)
    3. Confirmation submitted: Show matching films (people_results.html)
    
    Query params:
        name1, name2, name3: Input names
        confirm: If "1", this is a confirmation submission
        nconst1, nconst2, nconst3: Selected person IDs after confirmation
        name_input1, name_input2, name_input3: Original input names (for display)
    """
    # Check if this is a confirmation submission
    is_confirmation = request.args.get("confirm") == "1"
    
    if is_confirmation:
        return _handle_people_confirmation()
    
    # Check if names were submitted
    name1 = request.args.get("name1", "").strip()
    name2 = request.args.get("name2", "").strip()
    name3 = request.args.get("name3", "").strip()
    
    names = [n for n in [name1, name2, name3] if n]
    
    # No names - show search form
    if not names:
        return render_template("people_search.html")
    
    # Get candidates for each name
    candidate_lists = get_candidates_for_names(names)
    
    # If all names have exactly one unambiguous match, skip confirmation
    all_single_match = all(
        len(cl["candidates"]) == 1 
        for cl in candidate_lists
    )
    
    if all_single_match and candidate_lists:
        # Auto-confirm with the single matches
        person_ids = [cl["candidates"][0]["nconst"] for cl in candidate_lists]
        matched_people = [
            (cl["input"], cl["candidates"][0]["nconst"], cl["candidates"][0]["primaryName"])
            for cl in candidate_lists
        ]
        films_df = search_films_by_person_ids(person_ids)
        
        return render_template(
            "people_results.html",
            matched_people=matched_people,
            films=films_df.to_dict(orient="records"),
        )
    
    # Show confirmation page
    return render_template("people_confirm.html", candidate_lists=candidate_lists)


def _handle_people_confirmation():
    """Handle the confirmation form submission for multi-person search."""
    matched_people = []
    person_ids = []
    
    # Process up to 3 name inputs
    for i in range(1, 4):
        input_name = request.args.get(f"name_input{i}", "").strip()
        nconst_str = request.args.get(f"nconst{i}", "").strip()
        
        if not input_name:
            continue
        
        if nconst_str:
            nconst = int(nconst_str)
            person_ids.append(nconst)
            matched_name = get_person_name_by_id(nconst)
            matched_people.append((input_name, nconst, matched_name))
        else:
            # User selected "skip" for this name
            matched_people.append((input_name, None, None))
    
    # Search for films with the selected people
    if person_ids:
        films_df = search_films_by_person_ids(person_ids)
        films = films_df.to_dict(orient="records")
    else:
        films = []
    
    return render_template(
        "people_results.html",
        matched_people=matched_people,
        films=films,
    )


# =============================================================================
# Error Handlers
# =============================================================================

@app.errorhandler(404)
def page_not_found(e):
    """Handle 404 errors."""
    return render_template("home.html"), 404


@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors."""
    return f"<h1>Internal Server Error</h1><p>{str(e)}</p><a href='/'>Home</a>", 500


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  Kovarboxd - Movie Search Application")
    print("=" * 50)
    print("  Starting Flask development server...")
    print("  Visit: http://127.0.0.1:5000")
    print("=" * 50 + "\n")
    
    app.run(debug=True, host="127.0.0.1", port=5000)
