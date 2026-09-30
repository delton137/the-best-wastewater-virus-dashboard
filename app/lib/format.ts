/** Compact units while preserving small positive concentrations. */
export function fmtCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (magnitude >= 1e6) return `${(value / 1e6).toFixed(magnitude >= 1e7 ? 0 : 1)}M`;
  if (magnitude >= 1e3) return `${(value / 1e3).toFixed(0)}k`;
  return String(Number(value.toPrecision(3)));
}
