import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarChart, InsightsView } from "@/components/InsightCharts";
import { barPercent, hoursWatched, type Insights } from "@/lib/insights";

const data: Insights = {
  total: 1200,
  minutes: 7265,
  watchlist: 3,
  by_decade: [{ label: "1990s", count: 2 }],
  by_year_seen: [],
  genres: [{ label: "Crime", count: 3 }],
  directors: [{ id: 1032, label: "Martin Scorsese", count: 3 }],
  actors: [{ id: 380, label: "Robert De Niro", count: 3 }],
  pairs: [{ ids: [380, 1032], label: "Robert De Niro + Martin Scorsese", count: 3 }],
};

describe("helpers", () => {
  it("sizes bars against the longest", () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(0, 0)).toBe(0);
  });

  it("keeps tiny bars visible", () => {
    expect(barPercent(1, 1000)).toBe(1);
  });

  it("rounds hours up", () => {
    expect(hoursWatched(7265)).toBe("122");
    expect(hoursWatched(10)).toBe("1");
    expect(hoursWatched(0)).toBe("0");
  });
});

describe("charts render", () => {
  it("shows the headline numbers", () => {
    const html = renderToString(<InsightsView data={data} />);
    expect(html).toContain("1,200");
    expect(html).toContain("122");
    expect(html).toContain("hours watched");
  });

  it("links pairs to films together and people to their pages", () => {
    const html = renderToString(<InsightsView data={data} />);
    expect(html).toContain('href="/together?ids=380,1032"');
    expect(html).toContain('href="/person/1032-martin-scorsese"');
  });

  it("skips a chart with no data", () => {
    expect(renderToString(<BarChart title="Nothing" bars={[]} />)).toBe("");
    expect(renderToString(<InsightsView data={data} />)).not.toContain("year you saw them");
  });

  it("every bar's value is readable as text", () => {
    const html = renderToString(<BarChart title="T" bars={[{ label: "A", count: 7 }]} />);
    expect(html).toContain('title="A: 7 films"');
    expect(html).toMatch(/bar-value[^>]*>7</);
  });
});
