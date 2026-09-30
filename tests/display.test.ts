import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtCount } from "../app/lib/format";
import { isStale } from "../app/lib/freshness";

test("small concentrations stay visible in chart labels", () => {
  assert.equal(fmtCount(0.008213384), "0.00821");
  assert.equal(fmtCount(0.11), "0.11");
  assert.equal(fmtCount(0), "0");
  assert.equal(fmtCount(30_000_000), "30M");
  assert.equal(fmtCount(null), "");
  assert.equal(fmtCount(Infinity), "");
});

test("staleness uses observation dates and a UTC calendar-day cutoff", () => {
  const now = Date.parse("2026-09-24T20:30:00Z");
  assert.equal(isStale("2023-09-13", now), true);
  assert.equal(isStale("2026-06-25", now), true);
  assert.equal(isStale("2026-06-26", now), false);
  assert.equal(isStale("2026-09-24", now), false);
  assert.equal(isStale("invalid", now), true);
});
