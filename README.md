# Global Wastewater Viral Surveillance Dashboard

A public-good dashboard aggregating **wastewater (sewage) viral-concentration data**
for SARS-CoV-2, influenza, and more — from public sources worldwide, with as much
historical depth as each source allows (back to **2020** for the deepest series).

- **Map** of state/region activity, colored by each site's percentile within its own
  history (the only metric that's comparable across labs — absolute concentrations are not).
- **Pathogen switcher** and **trend charts** (national + drill-down per region).
- **Coverage page** with provenance, history span, and licensing for every source.

Currently ingesting **473k+ measurements** from CDC NWSS (US, 2020-07→, 2,330 sites,
SARS-CoV-2 + influenza A), Canada Health Infobase (2020-10→), and ESR New Zealand
(2021-06→). More connectors (RIVM NL, RKI DE, Obépine FR, Eawag CH, Queensland AU, plus
EU4S and historical archives) are tracked in the project plan.

## Architecture (free-tier-first)

Heavy ingestion runs **off Vercel** so the app fits Vercel's free Hobby tier:

```
GitHub Actions (weekly cron)  ──run connectors──▶  normalize (DuckDB)
        │                                                │
        │  commit public/aggregates/*.json               ├─▶ data/lake/**.parquet
        ▼  (triggers Vercel redeploy)                     ▼   (site-level, optional → Cloudflare R2)
Vercel (Next.js)  ──serves──▶  static JSON aggregates (map + trends)
                               DuckDB-WASM → R2 Parquet (site-level drill-down, future)
```

- **Ingestion** — TypeScript + [DuckDB](https://duckdb.org) (`@duckdb/node-api`). Each
  connector is a thin SQL transform reading a source (Socrata / CSV / GitHub) and emitting
  the unified `Measurement` schema. See `ingestion/connectors/`.
- **Aggregates** — `ingestion/lib/writers.ts` computes each site's within-history
  percentile, averages each site's readings before averaging across sites, then writes small JSON (`public/aggregates/`) the dashboard reads directly,
  plus a partitioned Parquet lake (`data/lake/`, optionally synced to R2).
- **Frontend** — Next.js (App Router) + MapLibre GL (OpenStreetMap raster basemap) + uPlot.

## Quick start

Requires **Node 20–22** (see caveat below).

```bash
npm install
npm run ingest:all   # pull all sources → public/aggregates/*.json + data/lake/
npm run dev          # http://localhost:3000
```

Fast iteration on a subset:

```bash
CDC_LIMIT=20000 npm run ingest -- cdc_nwss esr_nz   # cap CDC rows, pick connectors
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it on Vercel (framework auto-detected as Next.js; no env vars required for MVP).
   The committed `public/aggregates/*.json` is all the dashboard needs.
3. Enable the **Ingest** GitHub Action (Actions tab). It refreshes the aggregates weekly
   and commits them back, which triggers a Vercel redeploy. No Vercel cron needed.

### Optional: Cloudflare R2 (site-level Parquet)

For site-level / full-history drill-downs (DuckDB-WASM), set these as **GitHub repo
secrets** (the ingestion uploads the Parquet lake; 10 GB free, $0 egress). See
`.env.example`:

```
R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET  R2_PREFIX
```

Without them, ingestion is a no-op for R2 and the MVP runs entirely on JSON aggregates.

## Adding a connector

1. Create `ingestion/connectors/<source>.ts` exporting a `Connector` whose `selects()`
   returns SQL producing the canonical columns (wrap your inner SELECT in `canonicalize()`).
2. Register it in `ingestion/connectors/index.ts`.
3. Add a manifest entry to `shared/sources.ts` (drives the coverage page).
4. `npm run ingest -- <source>` and check the coverage page.

Map source units/labels into the controlled vocabularies in `shared/schema.ts`. Absolute
concentrations are kept faithfully in `value_raw`/`unit_raw`; cross-source comparison uses
the within-site percentile computed during aggregation.

## Caveat: local production build on Node 23

`next build` stalls in its compile worker on **Node 23.x** (an odd, non-LTS release
outside Next's supported range), and webpack's persistent cache fails on Dropbox/cloud-
synced folders. `npm run dev` and Vercel builds (Node 20/22, clean FS) are unaffected.
Use Node 20–22 locally (`nvm use`, an `.nvmrc` is provided) to build for production.

## Data sources & licensing

All current sources are public domain or openly licensed (CDC: U.S. public domain;
Canada: Open Government Licence; ESR NZ: open). Every value links back to its source on
the [coverage page](/coverage). Attribution is preserved per source license.

See the full source inventory and roadmap in the project plan.

## Validation and data safeguards

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All requested datasets must return rows successfully before ingestion replaces the
published files. A failed or empty dataset aborts the run and retains the existing
lake and aggregates. An explicitly selected subset still replaces the dataset with
that subset; use `ingest:all` for production refreshes.

Map and trend averages give each reporting site equal weight within the displayed
window or week. Seasonal medians retain fractional concentrations. Gray map markers
have a latest sample more than 90 days old; selecting a marker shows its sample date.
This threshold indicates data freshness, not a health-risk category.
