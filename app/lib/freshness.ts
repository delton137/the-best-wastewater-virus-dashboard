export const STALE_AFTER_DAYS = 90;

/** Compare calendar days in UTC so the cutoff is independent of browser timezone. */
export function isStale(latestDate: string, now = Date.now()): boolean {
  const sampled = Date.parse(latestDate);
  if (!Number.isFinite(sampled)) return true;
  return Math.floor(now / 86_400_000) - Math.floor(sampled / 86_400_000) > STALE_AFTER_DAYS;
}
