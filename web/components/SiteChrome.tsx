import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { SearchBox } from "./SearchBox";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Kovarboxd
      </Link>
      <Link className="nav-link" href="/together">
        Films together
      </Link>
      <Link className="nav-link" href="/me">
        My lists
      </Link>
      {/* Phones reach this through the tab in My lists: the header has no room. */}
      <Link className="nav-link nav-link-wide" href="/me/insights">
        Insights
      </Link>
      <SearchBox />
      <form action={signOut} className="logout">
        <button>Log out</button>
      </form>
    </header>
  );
}

/** The header on the login, signup and password pages: just the name. */
export function AuthHeader() {
  return (
    <header className="site-header">
      <span className="brand">Kovarboxd</span>
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
