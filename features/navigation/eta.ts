/**
 * Adaptive ETA calculator (FR-020).
 *
 * Pure: takes the live vessel fix, the active boat's cruise speed, and
 * the route distance, and returns an effective speed + arrival time.
 *
 * Source-selection rule:
 *   - If we have a live GPS speed above LIVE_SPEED_THRESHOLD_MPS we
 *     trust it (underway).
 *   - Otherwise fall back to the active boat's cruise speed (planning).
 *   - If neither is available, return null — the caller renders "—".
 */

const KNOTS_TO_MPS = 1 / 1.943844;

/** Below this, treat the vessel as effectively stationary. ~1 kn. */
const LIVE_SPEED_THRESHOLD_MPS = 0.5;

export interface EtaInput {
  distanceMeters: number;
  /** GPS speed over ground, m/s, or null if unknown. */
  liveSpeedMps: number | null;
  /** Active boat cruise speed in knots, or null. */
  cruiseSpeedKn: number | null;
}

export interface EtaResult {
  /** Speed used to compute the ETA, m/s. */
  effectiveSpeedMps: number;
  /** Where the speed came from. */
  source: 'live' | 'cruise';
  /** Trip duration in seconds. */
  durationSec: number;
  /** Estimated arrival epoch milliseconds. */
  arrivalEpochMs: number;
}

export function computeEta(input: EtaInput, now = Date.now()): EtaResult | null {
  const live = input.liveSpeedMps;
  let effectiveSpeedMps: number;
  let source: 'live' | 'cruise';

  if (live != null && live > LIVE_SPEED_THRESHOLD_MPS) {
    effectiveSpeedMps = live;
    source = 'live';
  } else if (input.cruiseSpeedKn != null && input.cruiseSpeedKn > 0) {
    effectiveSpeedMps = input.cruiseSpeedKn * KNOTS_TO_MPS;
    source = 'cruise';
  } else {
    return null;
  }

  const durationSec = input.distanceMeters / effectiveSpeedMps;
  const arrivalEpochMs = now + durationSec * 1000;
  return { effectiveSpeedMps, source, durationSec, arrivalEpochMs };
}

/**
 * Format a duration in seconds as "1 h 42 min" / "42 min" / "5 min".
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min === 0 ? `${hours} h` : `${hours} h ${min} min`;
}

/** Format an epoch-ms as a local clock time like "3:45 PM". */
export function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
