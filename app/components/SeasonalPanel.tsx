"use client";

import { useEffect, useMemo, useState } from "react";
import { PATHOGEN_LABELS, type Pathogen } from "@shared/schema";
import {
  loadSeasonal,
  type Seasonal,
  type SourceCoverage,
} from "../lib/aggregates";
import SeasonalChart from "./SeasonalChart";
import Provenance from "./Provenance";

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  NZ: "New Zealand",
  NL: "Netherlands",
  AU: "Australia",
};

export default function SeasonalPanel({ pathogen, country, onCountryChange, coverage, updatedAt }: {
  pathogen: Pathogen;
  country: string;
  onCountryChange: (country: string) => void;
  coverage: Record<string, SourceCoverage>;
  updatedAt?: string;
}) {
  const [seasonal, setSeasonal] = useState<Seasonal>({});
  const [error, setError] = useState<string | null>(null);
  const [logScale, setLogScale] = useState(false);
  const [smoothWeeks, setSmoothWeeks] = useState(1);

  useEffect(() => {
    loadSeasonal().then(setSeasonal).catch((e) => setError(String(e)));
  }, []);

  const countries = useMemo(() => Object.keys(seasonal).sort(), [seasonal]);
  const entry = seasonal[country]?.[pathogen];

  return (
    <>
        {error && <p className="muted">Could not load data: {error}</p>}

        <div className="controls">
          {countries.map((c) => (
            <button
              key={c}
              className={`chip ${c === country ? "active" : ""}`}
              onClick={() => onCountryChange(c)}
            >
              {COUNTRY_NAMES[c] ?? c}
            </button>
          ))}
        </div>
        <div className="controls">
          <label
            className="chip"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "default",
            }}
          >
            smoothing: {smoothWeeks <= 1 ? "none" : `${smoothWeeks} wk`}
            <input
              type="range"
              min={1}
              max={15}
              step={2}
              value={smoothWeeks}
              onChange={(e) => setSmoothWeeks(Number(e.target.value))}
              style={{ accentColor: "var(--accent)" }}
            />
          </label>
          <button
            className={`chip ${logScale ? "active" : ""}`}
            onClick={() => setLogScale((v) => !v)}
          >
            {logScale ? "log scale" : "linear scale"}
          </button>
        </div>

        <h2 className="section-title">
          {COUNTRY_NAMES[country] ?? country} — {PATHOGEN_LABELS[pathogen]} by month
        </h2>

        {entry ? (
          <>
            <SeasonalChart
              entry={entry}
              logScale={logScale}
              smoothWeeks={smoothWeeks}
            />
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Y-axis: weekly median across reporting sites ({entry.unit}). Each site
              contributes once per week, which removes the day-of-week sampling artifact
              that makes a raw per-day median oscillate. Unlike the dashboard map/trends
              (within-site percentile), this preserves the source&apos;s real concentration
              units, comparable within a country over time. Early years have fewer sites.
            </p>
            <Provenance
              updatedAt={updatedAt}
              sources={entry.sources}
              coverage={coverage}
            />
          </>
        ) : (
          <p className="muted">No seasonal data for this country and pathogen. Select another country or pathogen.</p>
        )}

    </>
  );
}
