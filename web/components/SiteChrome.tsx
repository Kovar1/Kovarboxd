import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Kovarboxd
      </Link>
      <SearchBox />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Movie data and images from{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          TMDB
        </a>
        , refreshed nightly.
      </p>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </footer>
  );
}
