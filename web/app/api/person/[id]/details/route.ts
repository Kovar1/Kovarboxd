import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/auth-client";
import { detailsAreStale, fetchPersonDetails, readStoredDetails, savePersonDetails } from "@/lib/person-details";
import { parseIdParam } from "@/lib/slug";

// Called by the person page in the browser when the stored details are
// missing or older than 30 days. POST, so prefetches and crawlers don't
// trigger it. Answers with the details to show.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // proxy.ts already turns away logged-out requests. This route writes to the
  // database, so it checks again rather than rely on the proxy alone.
  const {
    data: { user },
  } = await (await createAuthClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const id = parseIdParam((await params).id);
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const stored = await readStoredDetails(id);
  if (!stored) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Someone else already refreshed them since this page was cached.
  if (!detailsAreStale(stored.fetchedAt)) return NextResponse.json(stored.details);

  const fresh = await fetchPersonDetails(id);
  if (!fresh) return NextResponse.json(stored.details);
  if (await savePersonDetails(id, fresh)) {
    // The cached person page gets rebuilt with the details on its next visit.
    revalidateTag(`person-${id}`, "max");
  }
  return NextResponse.json(fresh);
}
