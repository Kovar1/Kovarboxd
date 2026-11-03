import Link from "next/link";
import { getListCounts } from "@/lib/user-lists";

export async function ListTabs({ active }: { active: "seen" | "watchlist" | "insights" }) {
  const counts = await getListCounts();
  return (
    <nav className="list-tabs" aria-label="My lists">
      <Link href="/me" className={active === "seen" ? "active" : ""}>
        Seen <span className="count">{counts.seen}</span>
      </Link>
      <Link href="/me?list=watchlist" className={active === "watchlist" ? "active" : ""}>
        Watchlist <span className="count">{counts.watchlist}</span>
      </Link>
      <Link href="/me/insights" className={active === "insights" ? "active" : ""}>
        Insights
      </Link>
    </nav>
  );
}
