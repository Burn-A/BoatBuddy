/**
 * Time / freshness helpers.
 *
 * Used by detail cards (NFR-004) to render an explicit badge when data
 * goes stale relative to the resource's freshness budget.
 */

export type Freshness = 'fresh' | 'aging' | 'stale';

export interface FreshnessOptions {
  /** Threshold above which data is considered aging, ms. */
  agingAfterMs: number;
  /** Threshold above which data is considered stale, ms. */
  staleAfterMs: number;
}

/** Classify an observation timestamp against freshness budgets. */
export function classifyFreshness(timestampMs: number, opts: FreshnessOptions): Freshness {
  const age = Date.now() - timestampMs;
  if (age > opts.staleAfterMs) return 'stale';
  if (age > opts.agingAfterMs) return 'aging';
  return 'fresh';
}

/** Human-friendly "5 min ago" / "2 h ago" string. */
export function formatRelative(timestampMs: number, now = Date.now()): string {
  const ageMs = Math.max(0, now - timestampMs);
  const sec = Math.round(ageMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}
