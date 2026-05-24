/**
 * Fuel range math (FR-025).
 *
 * Pure functions — no React, no storage. Inputs are SI-friendly where
 * sensible (meters at the boundary), domain figures are kept in the
 * boat-native units (gallons, gph, knots) because that's how the data
 * arrives from the spec sheet.
 */

import type { BoatProfile } from './types';

const METERS_PER_NM = 1852;

export interface RangeEstimate {
  /** Reserve-adjusted endurance, hours. */
  hours: number;
  /** Reserve-adjusted range, meters (for chart overlay). */
  meters: number;
  /** Range expressed in nautical miles. */
  nm: number;
  /** Effective fuel used in the estimate (gallons, after reserve). */
  effectiveFuelGal: number;
}

export interface RangeOptions {
  /** Override current fuel (gallons). Defaults to boat.currentFuelGal, else capacity. */
  fuelGal?: number;
  /**
   * Reserve fraction held back from the estimate. 0.2 means 20% reserve.
   * A 20% reserve is the conventional recreational-boating rule of thumb.
   */
  reserveFraction?: number;
}

/**
 * Estimate range from cruise burn rate. Returns zero if the boat has
 * no cruise speed or burn rate set (custom boat with incomplete specs).
 */
export function estimateRange(boat: BoatProfile, opts: RangeOptions = {}): RangeEstimate {
  const reserve = opts.reserveFraction ?? 0.2;
  const startFuel = opts.fuelGal ?? boat.currentFuelGal ?? boat.fuelCapacityGal;
  const effectiveFuel = Math.max(0, startFuel * (1 - reserve));

  if (boat.fuelBurnGph <= 0 || boat.cruiseSpeedKn <= 0) {
    return { hours: 0, meters: 0, nm: 0, effectiveFuelGal: effectiveFuel };
  }

  const hours = effectiveFuel / boat.fuelBurnGph;
  const nm = hours * boat.cruiseSpeedKn;
  const meters = nm * METERS_PER_NM;
  return { hours, meters, nm, effectiveFuelGal: effectiveFuel };
}
