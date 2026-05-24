/**
 * Global UI / domain state (Zustand).
 *
 * Per ARCHITECTURE.md §7, this store is for UI and domain state only.
 * Server data lives in TanStack Query. Don't mix the two.
 *
 * Persistence: a future M3 task will mirror a slice of this store into
 * IndexedDB. For M2 the store is in-memory.
 */

import { create } from 'zustand';
import { DEFAULT_UNITS, type UnitPrefs } from './units';
import type { BoatProfile } from '@/features/boat/types';
import type { Bbox } from './bbox';

export interface SelectedFeature {
  kind: 'tide' | 'wave';
  id: string;
  name: string;
}

export interface VesselFix {
  lat: number;
  lng: number;
  /** Speed over ground in m/s, when available. */
  speedMps: number | null;
  /** Heading in degrees true, when available. */
  headingDeg: number | null;
  /** Horizontal accuracy in meters. */
  accuracyM: number;
  /** Epoch ms when the fix was obtained. */
  timestamp: number;
}

export type LayerId =
  | 'tides'
  | 'waves'
  | 'aton'
  | 'hazards'
  | 'marinas'
  | 'depth';

export interface UiState {
  // Map orientation
  courseUp: boolean;
  setCourseUp: (v: boolean) => void;

  // Side menu (FR-050)
  sideMenuOpen: boolean;
  setSideMenuOpen: (v: boolean) => void;

  // Vessel position
  vessel: VesselFix | null;
  setVessel: (fix: VesselFix | null) => void;

  // Layer visibility (FR-053)
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;

  // Unit preferences (FR-051)
  units: UnitPrefs;
  setUnits: (u: Partial<UnitPrefs>) => void;

  // Boat library (FR-021, FR-022, FR-040)
  // Mutations belong in features/boat/profile.ts so persistence stays
  // co-located with state changes; these fields are read-mostly here.
  hydrated: boolean;
  boats: BoatProfile[];
  activeBoatId: string | null;

  // Map viewport — populated from the renderer's bbox-change events so
  // data layers can scope their queries (FR-010, FR-012).
  bbox: Bbox | null;
  setBbox: (b: Bbox | null) => void;

  // Currently-tapped tide station or wave buoy.
  selectedFeature: SelectedFeature | null;
  setSelectedFeature: (f: SelectedFeature | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  courseUp: false,
  setCourseUp: (v) => set({ courseUp: v }),

  sideMenuOpen: false,
  setSideMenuOpen: (v) => set({ sideMenuOpen: v }),

  vessel: null,
  setVessel: (fix) => set({ vessel: fix }),

  // M2: all overlay layers default off until M4 wires their data sources.
  layers: {
    tides: false,
    waves: false,
    aton: false,
    hazards: false,
    marinas: false,
    depth: false,
  },
  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),

  units: DEFAULT_UNITS,
  setUnits: (u) => set((s) => ({ units: { ...s.units, ...u } })),

  hydrated: false,
  boats: [],
  activeBoatId: null,

  bbox: null,
  setBbox: (b) => set({ bbox: b }),

  selectedFeature: null,
  setSelectedFeature: (f) => set({ selectedFeature: f }),
}));
