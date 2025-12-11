from flask import Flask, request, render_template
from search_movie import search_movies, get_movie_details
from search_person import search_persons, get_person_by_nconst
from search_people import search_people_by_nconsts
from tmdb import get_cached_poster, get_cached_actor_image, get_cached_movie_data

app = Flask(__name__)
app.config['TEMPLATES_AUTO_RELOAD'] = True


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/movie")
def movie_search():
    query = request.args.get("q")
    page = request.args.get("page", default=1, type=int)

    print(f"[ROUTE /movie] q={query!r} page={page}")

    # If no query yet → show search page
    if not query:
        return render_template("movie_search.html")

    # Run movie search → returns (df, has_next_page)
    results_df, has_next_page = search_movies(query, page=page)

    print(f"[ROUTE /movie] search returned {len(results_df)} rows, has_next={has_next_page}")

    # No results → show empty
    if results_df.empty:
        return render_template(
            "movie_results.html",
            movies=[],
            query=query,
            page=page,
            has_next_page=False
        )

    # Convert dataframe → list of dicts
    movies_list = results_df.to_dict(orient="records")

    # Add poster URLs
    for m in movies_list:
        # use cached poster if available; only call TMDb for cache misses
        if not m.get("poster_url"):
            m["poster_url"] = get_cached_poster(m["tconst"])

    # If EXACTLY ONE result → go directly to details page
    if len(movies_list) == 1:
        tconst = movies_list[0]["tconst"]
        selected_df, actors_df, crew_df = get_movie_details(tconst)
        # ensure poster is available for the selected movie (populate cache if missing)
        if not selected_df.iloc[0].get("poster_url"):
            sel_tconst = selected_df.iloc[0]["tconst"]
            poster = get_cached_poster(sel_tconst)
            selected_df.loc[selected_df.index[0], "poster_url"] = poster
        return render_template(
            "movie_details.html",
            movie=selected_df.to_dict(orient="records")[0],
            actors=actors_df.to_dict(orient="records"),
            crew=crew_df.to_dict(orient="records"),
            query=query,
            page=page
        )

    # Otherwise → show list of movies
    return render_template(
        "movie_results.html",
        movies=movies_list,
        query=query,
        page=page,
        has_next_page=has_next_page
    )


@app.route("/movie/<tconst>")
def movie_details(tconst):
    print(f"[ROUTE /movie/{tconst}] fetching details")
    selected_df, actors_df, crew_df = get_movie_details(tconst)
    
    # Fetch poster and overview from TMDb
    poster_url, overview = get_cached_movie_data(tconst)
    movie_dict = selected_df.to_dict(orient="records")[0]
    movie_dict["poster_url"] = poster_url
    movie_dict["overview"] = overview

    # Fetch profile images for actors
    actors_list = actors_df.to_dict(orient="records")
    for actor in actors_list:
        if not actor.get("profile_url"):
            try:
                actor["profile_url"] = get_cached_actor_image(actor["nconst"])
            except Exception as e:
                print(f"[ERROR fetching actor profile {actor['nconst']}] {e}")
                actor["profile_url"] = None

    # Fetch profile images for crew
    crew_list = crew_df.to_dict(orient="records")
    for crew_member in crew_list:
        if not crew_member.get("profile_url"):
            try:
                crew_member["profile_url"] = get_cached_actor_image(crew_member["nconst"])
            except Exception as e:
                print(f"[ERROR fetching crew profile {crew_member['nconst']}] {e}")
                crew_member["profile_url"] = None

    return render_template(
        "movie_details.html",
        movie=movie_dict,
        actors=actors_list,
        crew=crew_list
    )


# ---------------------------------------------------------
# NEW — FETCH PERSON DIRECTLY BY NCONST
# ---------------------------------------------------------
@app.route("/person/<nconst>")
def person_by_nconst(nconst):
    print(f"[ROUTE /person/{nconst}] fetching person by nconst")
    person_df, movies_df = get_person_by_nconst(nconst)

    if person_df is None:
        return render_template("person_details.html", person=None, movies=[])

    # Ensure profile image is available (populate cache if missing)
    if not person_df.iloc[0].get("profile_url"):
        try:
            from tmdb import get_cached_actor_image
            profile = get_cached_actor_image(person_df.iloc[0]["nconst"])
            person_df.loc[person_df.index[0], "profile_url"] = profile
        except Exception:
            # silently ignore fetch errors (template will show placeholder)
            pass

    # Ensure movie posters are available (populate cache if missing)
    movies_list = movies_df.to_dict(orient="records")
    for m in movies_list:
        if not m.get("poster_url"):
            try:
                m["poster_url"] = get_cached_poster(m["tconst"])
            except Exception:
                m["poster_url"] = None

    # Organize movies by category (role type)
    movies_by_category = {}
    for m in movies_list:
        category = m.get('category', 'unknown')
        # Normalize category names
        if category in ['actor', 'actress']:
            category = 'actor'
        elif category == 'self':
            category = 'actor'  # treat self as actor
        
        if category not in movies_by_category:
            movies_by_category[category] = []
        movies_by_category[category].append(m)
    
    # Sort categories: actor first, then alphabetically
    sorted_categories = sorted(movies_by_category.keys(), 
                              key=lambda x: (x != 'actor', x))

    return render_template(
        "person_details.html",
        person=person_df.to_dict(orient="records")[0],
        movies=movies_list,
        movies_by_category=movies_by_category,
        categories=sorted_categories
    )


# ---------------------------------------------------------
# EXISTING — fallback search by name
# ---------------------------------------------------------
@app.route("/person")
def person_search_route():
    query = request.args.get("q")
    page = request.args.get("page", default=1, type=int)

    if not query:
        return render_template("person_search.html")

    # Fetch ALL candidates (not paginated at query level)
    per_page = 9
    all_persons = []
    page_num = 1
    max_candidates = 100
    
    while len(all_persons) < max_candidates:
        results_df, has_next = search_persons(query, page=page_num)
        if results_df.empty:
            break
        all_persons.extend(results_df.to_dict(orient="records"))
        if not has_next:
            break
        page_num += 1

    if not all_persons:
        return render_template(
            "person_results.html",
            persons=[],
            query=query,
            page=page,
            has_next_page=False
        )

    # Add profile URLs (fetch on-demand if missing from cache)
    for p in all_persons:
        if not p.get("profile_url"):
            try:
                p["profile_url"] = get_cached_actor_image(p["nconst"])
            except Exception as e:
                print(f"[ERROR fetching profile for {p['nconst']}] {e}")
                p["profile_url"] = None

    # Re-sort: people with images first, then by name
    all_persons.sort(key=lambda p: (not bool(p.get("profile_url")), p.get("primaryName", "")))

    # Now apply pagination to the sorted list
    offset = (page - 1) * per_page
    paginated_list = all_persons[offset:offset + per_page + 1]
    has_next_page = len(paginated_list) > per_page
    display_list = paginated_list[:per_page]

    # If EXACTLY ONE result → go directly to details page
    if len(all_persons) == 1:
        nconst = all_persons[0]["nconst"]
        person_df, movies_df = get_person_by_nconst(nconst)

        # Ensure movie posters are available
        movies_list = movies_df.to_dict(orient="records")
        for m in movies_list:
            if not m.get("poster_url"):
                try:
                    m["poster_url"] = get_cached_poster(m["tconst"])
                except Exception:
                    m["poster_url"] = None

        # Organize movies by category
        movies_by_category = {}
        for m in movies_list:
            category = m.get('category', 'unknown')
            if category in ['actor', 'actress']:
                category = 'actor'
            elif category == 'self':
                category = 'actor'
            
            if category not in movies_by_category:
                movies_by_category[category] = []
            movies_by_category[category].append(m)
        
        sorted_categories = sorted(movies_by_category.keys(), 
                                  key=lambda x: (x != 'actor', x))

        return render_template(
            "person_details.html",
            person=person_df.to_dict(orient="records")[0],
            movies=movies_list,
            movies_by_category=movies_by_category,
            categories=sorted_categories,
            query=query,
            page=page
        )

    return render_template(
        "person_results.html",
        persons=display_list,
        query=query,
        page=page,
        has_next_page=has_next_page
    )


@app.route("/people")
def people_search_route():
    # Accept up to 3 name inputs as query params name1,name2,name3
    name1 = request.args.get("name1", "").strip()
    name2 = request.args.get("name2", "").strip()
    name3 = request.args.get("name3", "").strip()

    # On confirmation submission, also check for name_input1/2/3 (fallback)
    if request.args.get("confirm"):
        if not name1:
            name1 = request.args.get("name_input1", "").strip()
        if not name2:
            name2 = request.args.get("name_input2", "").strip()
        if not name3:
            name3 = request.args.get("name_input3", "").strip()

    # If no names provided -> render search form
    if not (name1 or name2 or name3):
        return render_template("people_search.html")

    names = [n for n in (name1, name2, name3) if n]
    # Track original positions (1, 2, or 3) for each name
    name_positions = []
    for pos, name_var in enumerate([name1, name2, name3], start=1):
        if name_var:
            name_positions.append(pos)

    # If the user submitted explicit selected nconsts from the confirmation form, run search by nconsts
    if request.args.get("confirm"):
        # Build list of selected nconsts in positional order (nconst1..nconst3)
        selected_nconsts_for_search = []
        for i in range(1, 4):
            v = request.args.get(f"nconst{i}")
            if v:
                selected_nconsts_for_search.append(v)

        # Build matched_people as tuples (input_name, nconst, matched_name)
        matched_people = []
        for i in range(1, 4):
            input_name = request.args.get(f'name_input{i}', '').strip()
            nconst_val = request.args.get(f"nconst{i}")
            if nconst_val:
                try:
                    p_df, _ = get_person_by_nconst(nconst_val)
                    if p_df is not None and not p_df.empty:
                        matched_people.append((input_name or f'Person {i}', nconst_val, p_df.iloc[0]['primaryName']))
                    else:
                        matched_people.append((input_name or f'Person {i}', nconst_val, None))
                except Exception:
                    matched_people.append((input_name or f'Person {i}', nconst_val, None))
            else:
                # No selection for this input
                if input_name:
                    matched_people.append((input_name, None, None))

        if not selected_nconsts_for_search:
            films_list = []
        else:
            films_df = search_people_by_nconsts(selected_nconsts_for_search)
            films_list = films_df.to_dict(orient="records") if not films_df.empty else []
            # Fetch missing posters on-demand
            for f in films_list:
                if not f.get("poster_url"):
                    f["poster_url"] = get_cached_poster(f["tconst"])

        return render_template("people_results.html", films=films_list, matched_people=matched_people)

    # Otherwise: resolve candidate lists for each input name using search_persons
    candidate_lists = []
    ambiguous = False
    for name, original_pos in zip(names, name_positions):
        candidates_df, _ = search_persons(name, page=1)
        candidates = []
        for _, r in candidates_df.head(6).iterrows():
            nconst_val = r['nconst']
            # Try to get profile_url from query result; if NULL, fetch on-demand
            profile_url = r.get('profile_url') if 'profile_url' in r.index else None
            if not profile_url:
                # Cache miss/null — fetch and cache the profile image
                profile_url = get_cached_actor_image(nconst_val)
            candidates.append({
                'nconst': nconst_val,
                'primaryName': r['primaryName'],
                'profile_url': profile_url
            })
        
        # Re-sort candidates: people with images first, then by name
        candidates.sort(key=lambda c: (not bool(c.get('profile_url')), c.get('primaryName', '')))
        
        candidate_lists.append({
            'input': name,
            'original_position': original_pos,
            'candidates': candidates
        })
        if len(candidates) > 1:
            ambiguous = True

    # If any input is ambiguous, render confirmation page where user picks exact matches
    if ambiguous:
        return render_template('people_confirm.html', candidate_lists=candidate_lists)

    # Otherwise, all inputs resolved to 0 or 1 candidate → collect nconsts and run intersection
    resolved_nconsts = []
    matched_people = []
    for cl in candidate_lists:
        if cl['candidates']:
            nconst_val = cl['candidates'][0]['nconst']
            resolved_nconsts.append(nconst_val)
            matched_name = cl['candidates'][0]['primaryName']
            matched_people.append((cl['input'], nconst_val, matched_name))
        else:
            matched_people.append((cl['input'], None, None))

    if not resolved_nconsts:
        films_list = []
    else:
        films_df = search_people_by_nconsts(resolved_nconsts)
        films_list = films_df.to_dict(orient='records') if not films_df.empty else []
        # Fetch missing posters on-demand
        for f in films_list:
            if not f.get("poster_url"):
                f["poster_url"] = get_cached_poster(f["tconst"])

    return render_template('people_results.html', films=films_list, matched_people=matched_people)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
