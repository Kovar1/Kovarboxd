"use client";

import { useEffect, useState } from "react";
import { lifeFacts } from "@/lib/format";
import type { PersonDetails } from "@/lib/types";

/**
 * Life facts and biography. When the stored details are missing or old, asks
 * the server to fetch them from TMDb once the page is open in a browser, and
 * shows them when they arrive.
 */
export function PersonFacts({
  id,
  initial,
  stale,
  asOf,
}: {
  id: number;
  initial: PersonDetails;
  stale: boolean;
  asOf: string;
}) {
  const [details, setDetails] = useState(initial);

  useEffect(() => {
    if (!stale) return;
    const controller = new AbortController();
    fetch(`/api/person/${id}/details`, { method: "POST", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PersonDetails>) : null))
      .then((fresh) => {
        if (fresh) setDetails(fresh);
      })
      .catch(() => {
        // Aborted or offline: keep what's shown.
      });
    return () => controller.abort();
  }, [id, stale]);

  return (
    <>
      {lifeFacts(details, asOf).map((fact) => (
        <p key={fact} className="facts">
          {fact}
        </p>
      ))}
      {details.biography && (
        <div className="bio">
          {details.biography.split(/\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}
    </>
  );
}
