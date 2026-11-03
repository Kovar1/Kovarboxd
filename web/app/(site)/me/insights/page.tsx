import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InsightsView } from "@/components/InsightCharts";
import { ListTabs } from "@/components/ListTabs";
import type { Insights } from "@/lib/insights";
import { currentUser } from "@/lib/user-lists";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <section>
      <h1>My lists</h1>
      <Suspense fallback={<p className="empty">Loading...</p>}>
        <MyInsights />
      </Suspense>
    </section>
  );
}

async function MyInsights() {
  await connection();
  const me = await currentUser();
  const { data, error } = me ? await me.db.rpc("my_insights") : { data: null, error: null };
  if (error) throw new Error(`insights: ${error.message}`);
  const insights = data as Insights | null;

  return (
    <>
      <ListTabs active="insights" />
      {insights && insights.total > 0 ? (
        <InsightsView data={insights} />
      ) : (
        <p className="empty">Mark some films as seen and your numbers will show up here.</p>
      )}
    </>
  );
}
