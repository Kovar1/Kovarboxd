import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { SearchBox } from "./SearchBox";

// Which nav link is underlined comes from the page's own class (see globals.css),
// so the header stays a cached server component.
export function Header() {
  return (
    <header className="hd">
      <Link className="wm" href="/">
        Kovarboxd
      </Link>
      <nav className="bar" aria-label="Main">
        <Link className="nav-together" href="/together">
          Films together
        </Link>
        <Link className="nav-lists" href="/me">
          My lists
        </Link>
        <Link className="nav-insights" href="/me/insights">
          Insights
        </Link>
      </nav>
      <SearchBox />
      <form action={signOut} className="logout">
        <button>Log out</button>
      </form>
    </header>
  );
}

/** The header on the login, signup and password pages: just the name, at full size. */
export function AuthHeader() {
  return (
    <header className="hd hd-big">
      <span className="wm">Kovarboxd</span>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="ft">
      <p>
        Movie data and images from{" "}
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          TMDB
        </a>
        , refreshed nightly. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
