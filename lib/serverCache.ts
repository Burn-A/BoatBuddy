/**
 * Tiny in-memory TTL cache for the BFF.
 *
 * Per ARCHITECTURE.md §10 production should use Upstash Redis so cache
 * survives across Vercel function instances; this in-process Map is the
 * dependency-free first cut. The interface here matches what an Upstash
 * adapter would expose, so the swap is mechanical.
 *
 * Server-only — never import from a client component.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, Entry<unknown>>();

/**
 * Get-or-compute. If the cached entry is still fresh, returns it.
 * Otherwise calls `producer` and stores the result with the given TTL.
 */
export async function withTtl<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const value = await producer();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export const TTL = {
  ONE_MINUTE: 60_000,
  THIRTY_MINUTES: 30 * 60_000,
  ONE_HOUR: 60 * 60_000,
  ONE_DAY: 24 * 60 * 60_000,
} as const;
