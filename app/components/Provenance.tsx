"use client";

import { SOURCE_BY_ID } from "@shared/sources";
import type { SourceCoverage } from "../lib/aggregates";

/** Shorten a dataset URL to host + last path segment for display. */
function shortUrl(u: string): string {
  try {
    const { host, pathname } = new URL(u);
    const seg = pathname.split("/").filter(Boolean).pop();
    return seg ? `${host}/${seg}` : host;
  } catch {
    return u;
  }
}

/**
 * Inline data-origin attribution. Resolves source_ids via the SOURCES manifest (name,
 * homepage, license) and, when coverage is supplied, shows the retrieval date and exact
 * dataset URLs — so users can always see and follow where a value came from.
 */
export default function Provenance({
  sources,
  provenanceUrls,
  coverage,
  updatedAt,
  prefix = "Source",
}: {
  sources: string[] | undefined;
  provenanceUrls?: string[];
  coverage?: Record<string, SourceCoverage>;
  updatedAt?: string;
  prefix?: string;
}) {
  if (!sources?.length) return null;
  const retrieved = sources
    .map((id) => coverage?.[id]?.retrieved_at)
    .filter(Boolean)
    .map((r) => (r as string).slice(0, 10))
    .sort()
    .pop();

  return (
    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
      {prefix}:{" "}
      {sources.map((id, i) => {
        const s = SOURCE_BY_ID[id];
        const name = s?.name ?? id;
        return (
          <span key={id}>
            {i > 0 && "; "}
            {s?.homepage ? (
              <a href={s.homepage} target="_blank" rel="noreferrer">
                {name}
              </a>
            ) : (
              name
            )}
            {s?.license ? ` — ${s.license}` : ""}
          </span>
        );
      })}
      {updatedAt
        ? ` · updated ${new Date(updatedAt).toLocaleDateString()}`
        : retrieved ? ` · retrieved ${retrieved}` : ""}
      {provenanceUrls?.length ? (
        <>
          {" "}
          ·{" "}
          {provenanceUrls.map((u, i) => (
            <span key={u}>
              {i > 0 && ", "}
              <a href={u} target="_blank" rel="noreferrer">
                {shortUrl(u)}
              </a>
            </span>
          ))}
        </>
      ) : null}
      {" · "}
      <a href="/coverage">{updatedAt ? "data sources & coverage →" : "full provenance →"}</a>
    </p>
  );
}
