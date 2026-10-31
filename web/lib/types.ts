// Row shapes returned from the kovarboxd schema through the Data API.

export type MovieSummary = {
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  popularity: number | null;
};

export type PersonSummary = {
  tmdb_id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  popularity: number | null;
};

export type CastCredit = {
  credit_id: string;
  character: string | null;
  cast_order: number | null;
};

export type CrewCredit = {
  credit_id: string;
  department: string | null;
  job: string | null;
};

/** A credit as stored: cast credits use character/cast_order, crew credits department/job. */
export type Credit = CastCredit &
  CrewCredit & {
    kind: "cast" | "crew";
  };

export type MovieDetail = {
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  original_language: string | null;
  release_date: string | null;
  release_year: number | null;
  runtime: number | null;
  overview: string | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number | null;
  vote_average: number | null;
  vote_count: number | null;
  budget: number | null;
  revenue: number | null;
  status: string | null;
  genres: { id: number; name: string }[];
  credits: (Credit & { person: Pick<PersonSummary, "tmdb_id" | "name" | "profile_path"> })[];
};

export type FilmCredit = Credit & {
  movie: MovieSummary & { release_date: string | null };
};

export type PersonDetail = PersonSummary & {
  gender: number | null;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  credits: FilmCredit[];
  /** "YYYY-MM-DD" the cached page was built, for computing ages. */
  as_of: string;
};
