/** Compact units while preserving small positive concentrations. */
export function fmtCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const magnitude = Math.abs(value);
  // 3 significant digits, so ticks like 12.5M or 2.5k are not rounded to 13M / 3k.
  const sig = (v: number) => Number(v.toPrecision(3));
  if (magnitude >= 1e9) return `${sig(value / 1e9)}B`;
  if (magnitude >= 1e6) return `${sig(value / 1e6)}M`;
  if (magnitude >= 1e3) return `${sig(value / 1e3)}k`;
  return String(sig(value));
}
