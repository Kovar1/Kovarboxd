import Link from "next/link";
import { barPercent, hoursWatched, type Bar, type Insights } from "@/lib/insights";
import { personPath } from "@/lib/slug";
import { togetherPath } from "@/lib/together";

/**
 * A horizontal bar chart in plain HTML: one series, one color, the value at the
 * tip of each bar. Each row is text, so it reads the same without the bars.
 */
export function BarChart({ title, bars, unit = "film" }: { title: string; bars: Bar[]; unit?: string }) {
  if (!bars.length) return null;
  const max = Math.max(...bars.map((b) => b.count));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <ol className="bars">
        {bars.map((bar) => {
          const label = bar.href ? <Link href={bar.href}>{bar.label}</Link> : bar.label;
          return (
            <li key={bar.label} title={`${bar.label}: ${bar.count} ${unit}${bar.count === 1 ? "" : "s"}`}>
              <span className="bar-label">{label}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${barPercent(bar.count, max)}%` }} />
                <span className="bar-value">{bar.count}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function InsightsView({ data }: { data: Insights }) {
  return (
    <>
      <dl className="stat-row">
        <div>
          <dd>{data.total.toLocaleString("en-US")}</dd>
          <dt>films seen</dt>
        </div>
        <div>
          <dd>{hoursWatched(data.minutes)}</dd>
          <dt>hours watched</dt>
        </div>
        <div>
          <dd>{data.watchlist.toLocaleString("en-US")}</dd>
          <dt>on your watchlist</dt>
        </div>
      </dl>
      <div className="chart-grid">
        <BarChart
          title="People you've seen together most"
          bars={data.pairs.map((p) => ({ label: p.label, count: p.count, href: togetherPath(p.ids) }))}
        />
        <BarChart
          title="Directors"
          bars={data.directors.map((d) => ({ label: d.label, count: d.count, href: personPath(d.id, d.label) }))}
        />
        <BarChart
          title="Actors"
          bars={data.actors.map((a) => ({ label: a.label, count: a.count, href: personPath(a.id, a.label) }))}
        />
        <BarChart title="Genres" bars={data.genres} />
        <BarChart title="Films by decade of release" bars={data.by_decade} />
        <BarChart title="Films by year you saw them" bars={data.by_year_seen} />
      </div>
    </>
  );
}
