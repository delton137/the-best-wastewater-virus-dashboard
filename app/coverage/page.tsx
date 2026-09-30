"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SOURCES } from "@shared/sources";
import { PATHOGEN_LABELS } from "@shared/schema";
import { loadCoverage, type SourceCoverage } from "../lib/aggregates";

/** host + last path segment, e.g. "data.cdc.gov/j9g8-acpt". */
function datasetLabel(u: string): string {
  try {
    const { host, pathname } = new URL(u);
    const seg = pathname.split("/").filter(Boolean).pop();
    return seg ? `${host}/${seg}` : host;
  } catch {
    return u;
  }
}

export default function CoveragePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cov, setCov] = useState<Record<string, SourceCoverage>>({});

  useEffect(() => {
    loadCoverage()
      .then((rows) =>
        setCov(Object.fromEntries(rows.map((r) => [r.source_id, r]))),
      )
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Data Sources & Coverage</h1>
        <span className="sub">Provenance, history span, and licensing</span>
        <nav>
          <Link href="/">← Dashboard</Link>
        </nav>
      </header>

      <div className="content">
        <p className="muted">
          Every value links back to its public source. Absolute concentrations
          are not comparable across labs, so the dashboard&apos;s default metric
          is each site&apos;s percentile within its own history. Sources marked{" "}
          <span className="badge planned">planned</span> are mapped but not yet
          ingested.
        </p>

        {loading && <p role="status">Loading source coverage…</p>}
        {error && <p role="alert">Could not load source coverage: {error}</p>}
        {!loading && !error && <table className="coverage">
          <thead>
            <tr>
              <th>Source</th>
              <th>Coverage</th>
              <th>Pathogens</th>
              <th>History (ingested)</th>
              <th>Rows / sites</th>
              <th>License</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const c = cov[s.id];
              return (
                <tr key={s.id}>
                  <td>
                    <a href={s.homepage} target="_blank" rel="noreferrer">
                      {s.name}
                    </a>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Tier {s.tier} · {s.access}
                      {!s.implemented && (
                        <>
                          {" "}
                          · <span className="badge planned">planned</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>{s.region_label}</td>
                  <td>
                    {s.pathogens.map((p) => (
                      <span key={p} className="badge">
                        {PATHOGEN_LABELS[p]}
                      </span>
                    ))}
                  </td>
                  <td>
                    {c ? (
                      <>
                        {c.min_date} → {c.max_date}
                        <div className="muted" style={{ fontSize: 11 }}>
                          retrieved {c.retrieved_at?.slice(0, 10)}
                        </div>
                        {c.provenance_urls?.length ? (
                          <div style={{ fontSize: 11, marginTop: 2 }}>
                            {c.provenance_urls.map((u) => (
                              <div key={u}>
                                <a href={u} target="_blank" rel="noreferrer">
                                  {datasetLabel(u)}
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">expected from {s.earliest}</span>
                    )}
                  </td>
                  <td>
                    {c ? (
                      <>
                        {c.rows.toLocaleString()} / {c.n_sites.toLocaleString()}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{s.license}</td>
                </tr>
              );
            })}
          </tbody>
        </table>}

        <p className="muted" style={{ marginTop: 20, fontSize: 12 }}>
          Roadmap sources (RIVM NL, RKI DE, Obépine FR, Eawag CH, Queensland AU,
          plus EU4S and historical archives Biobot / Ontario / UK) are tracked in
          the project plan and will appear here as their connectors land.
        </p>
      </div>
    </>
  );
}
