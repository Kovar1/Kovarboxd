"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { lifeRows } from "@/lib/format";
import type { PersonDetails } from "@/lib/types";
import { LabelRow } from "./Jumpsuit";

const Details = createContext<PersonDetails | null>(null);

/**
 * Holds a person's life facts and biography, which show in different parts of
 * the page. When the stored details are missing or old, asks the server to
 * fetch them from TMDb once the page is open in a browser, and shows them when
 * they arrive.
 */
export function PersonDetailsProvider({
  id,
  initial,
  stale,
  children,
}: {
  id: number;
  initial: PersonDetails;
  stale: boolean;
  children: ReactNode;
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

  return <Details.Provider value={details}>{children}</Details.Provider>;
}

export function PersonLifeRows({ asOf }: { asOf: string }) {
  const details = useContext(Details);
  if (!details) return null;
  return lifeRows(details, asOf).map(([name, value]) => <LabelRow key={name} name={name} value={value} />);
}

const SHORT_BIO = 520;

/** The biography, cut short at first so it doesn't push the films down the page. */
export function PersonBio() {
  const details = useContext(Details);
  const [open, setOpen] = useState(false);
  if (!details?.biography) return null;
  const paragraphs = details.biography.split(/\n+/).filter(Boolean);
  const whole = paragraphs.join(" ");
  const long = whole.length > SHORT_BIO;
  return (
    <>
      {long && !open ? (
        <p className="body">{whole.slice(0, SHORT_BIO).trimEnd()}...</p>
      ) : (
        paragraphs.map((para, i) => (
          <p key={i} className="body">
            {para}
          </p>
        ))
      )}
      {long && (
        <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Read the rest"}
        </button>
      )}
    </>
  );
}
