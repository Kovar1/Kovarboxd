import Link from "next/link";
import { getListCounts } from "@/lib/user-lists";

export async function ListTabs({ active }: { active: "seen" | "watchlist" | "insights" }) {
  const counts = await getListCounts();
  return (
    <nav className="tabs" aria-label="My lists">
      <Link href="/me" className={active === "seen" ? "on" : ""}>
        Seen <span className="count">{counts.seen}</span>
      </Link>
      <Link href="/me?list=watchlist" className={active === "watchlist" ? "on" : ""}>
        Watchlist <span className="count">{counts.watchlist}</span>
      </Link>
      <Link href="/me/insights" className={active === "insights" ? "on" : ""}>
        Insights
      </Link>
    </nav>
  );
}
