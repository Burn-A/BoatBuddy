/**
 * Unit system and conversions.
 *
 * BoatBuddy default is imperial+nautical (knots, nautical miles, feet),
 * per FR-051. All internal storage is in SI base units (meters, m/s) and
 * we convert at the UI boundary.
 */

export type DistanceUnit = 'nm' | 'mi' | 'km';
export type SpeedUnit = 'kn' | 'mph' | 'kmh';
export type DepthUnit = 'ft' | 'm';
export type TempUnit = 'F' | 'C';

export interface UnitPrefs {
  distance: DistanceUnit;
  speed: SpeedUnit;
  depth: DepthUnit;
  temp: TempUnit;
}

export const DEFAULT_UNITS: UnitPrefs = {
  distance: 'nm',
  speed: 'kn',
  depth: 'ft',
  temp: 'F',
};

const METERS_PER_NM = 1852;
const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;
const METERS_PER_FOOT = 0.3048;

/** Convert meters to the chosen distance unit. */
export function fromMeters(m: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'nm':
      return m / METERS_PER_NM;
    case 'mi':
      return m / METERS_PER_MILE;
    case 'km':
      return m / METERS_PER_KM;
  }
}

/** Convert m/s to the chosen speed unit. */
export function fromMps(mps: number, unit: SpeedUnit): number {
  switch (unit) {
    case 'kn':
      return mps * 1.943844;
    case 'mph':
      return mps * 2.236936;
    case 'kmh':
      return mps * 3.6;
  }
}

/** Convert meters of depth to the chosen depth unit. */
export function depthFromMeters(m: number, unit: DepthUnit): number {
  return unit === 'ft' ? m / METERS_PER_FOOT : m;
}

export function formatDistance(meters: number, unit: DistanceUnit, fractionDigits = 1): string {
  return `${fromMeters(meters, unit).toFixed(fractionDigits)} ${unit}`;
}

export function formatSpeed(mps: number, unit: SpeedUnit, fractionDigits = 1): string {
  const v = fromMps(mps, unit).toFixed(fractionDigits);
  const label = unit === 'kn' ? 'kn' : unit === 'mph' ? 'mph' : 'km/h';
  return `${v} ${label}`;
}
