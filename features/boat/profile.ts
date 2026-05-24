/**
 * Boat profile CRUD.
 *
 * Single source of truth for boat-library mutations. Every change goes
 * through here so we have one place to:
 *   1. Update the Zustand store (so the UI reacts).
 *   2. Persist to IndexedDB (so it survives reload — FR-040).
 *
 * Hydration is the inverse: read from IDB, push into store.
 */

import { useUiStore } from '@/lib/store';
import {
  deleteBoat as idbDelete,
  listBoats as idbList,
  putBoat as idbPut,
  getPref,
  setPref,
  PREF_ACTIVE_BOAT_ID,
} from '@/lib/storage';
import { getSeedBoat } from './seedDb';
import type { BoatProfile, BoatSeed } from './types';

function nowMs(): number {
  return Date.now();
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers; ok because all v1 targets support
  // crypto.randomUUID, but defending against the type system.
  return `bb-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Read the persisted library and active-boat pref into the Zustand
 * store. Call once on app start (from the map view's useEffect).
 */
export async function hydrateBoatLibrary(): Promise<void> {
  const store = useUiStore.getState();
  if (store.hydrated) return;

  try {
    const [boats, activeBoatId] = await Promise.all([
      idbList(),
      getPref<string>(PREF_ACTIVE_BOAT_ID),
    ]);

    // Deterministic ordering: newest-edited first feels right in the UI.
    boats.sort((a, b) => b.updatedAt - a.updatedAt);

    useUiStore.setState({
      boats,
      activeBoatId: activeBoatId ?? boats[0]?.uuid ?? null,
      hydrated: true,
    });
  } catch (err) {
    // Don't block the map view on storage failure — degrade gracefully.
    // eslint-disable-next-line no-console
    console.warn('[BoatBuddy] hydrateBoatLibrary failed:', err);
    useUiStore.setState({ hydrated: true });
  }
}

/** Create a profile from a seed entry. Returns the persisted profile. */
export async function createFromSeed(seedId: string): Promise<BoatProfile> {
  const seed = getSeedBoat(seedId);
  if (!seed) throw new Error(`Unknown seed boat: ${seedId}`);

  const profile: BoatProfile = {
    ...seed,
    uuid: makeUuid(),
    source: 'seed',
    seedId: seed.id,
    displayName: `${seed.manufacturer} ${seed.model}`,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };

  await idbPut(profile);
  bumpLibrary((boats) => [profile, ...boats], profile.uuid);
  return profile;
}

/** Create a fully custom profile. Caller supplies the editable fields. */
export async function createCustom(
  init: Partial<BoatProfile> & { displayName: string },
): Promise<BoatProfile> {
  const base: BoatProfile = {
    uuid: makeUuid(),
    id: `custom-${makeUuid().slice(0, 8)}`,
    manufacturer: 'Custom',
    model: 'Custom',
    category: 'other',
    loaFt: 0,
    beamFt: 0,
    draftFt: 0,
    displacementLbs: 0,
    engineType: 'outboard',
    totalHp: 0,
    cruiseSpeedKn: 0,
    maxSpeedKn: 0,
    fuelCapacityGal: 0,
    fuelBurnGph: 0,
    fuelType: 'gasoline',
    source: 'custom',
    displayName: init.displayName,
    createdAt: nowMs(),
    updatedAt: nowMs(),
    ...init,
  };

  await idbPut(base);
  bumpLibrary((boats) => [base, ...boats], base.uuid);
  return base;
}

/** Apply a partial update to an existing profile. */
export async function updateBoat(
  uuid: string,
  patch: Partial<BoatProfile>,
): Promise<BoatProfile | null> {
  const existing = useUiStore.getState().boats.find((b) => b.uuid === uuid);
  if (!existing) return null;

  const next: BoatProfile = { ...existing, ...patch, uuid, updatedAt: nowMs() };
  await idbPut(next);
  bumpLibrary((boats) => boats.map((b) => (b.uuid === uuid ? next : b)));
  return next;
}

/** Delete a profile. If it was active, the next-newest becomes active. */
export async function deleteBoatProfile(uuid: string): Promise<void> {
  await idbDelete(uuid);
  const state = useUiStore.getState();
  const remaining = state.boats.filter((b) => b.uuid !== uuid);
  const nextActive = state.activeBoatId === uuid ? (remaining[0]?.uuid ?? null) : state.activeBoatId;
  if (state.activeBoatId === uuid) {
    await setPref(PREF_ACTIVE_BOAT_ID, nextActive);
  }
  useUiStore.setState({ boats: remaining, activeBoatId: nextActive });
}

/** Mark the given boat as the active one (used everywhere ETA is computed). */
export async function setActiveBoat(uuid: string | null): Promise<void> {
  await setPref(PREF_ACTIVE_BOAT_ID, uuid);
  useUiStore.setState({ activeBoatId: uuid });
}

/* ─────────── private helpers ─────────── */

function bumpLibrary(
  fn: (boats: BoatProfile[]) => BoatProfile[],
  makeActiveIfNoneSelected?: string,
): void {
  const state = useUiStore.getState();
  const boats = fn(state.boats);
  const activeBoatId =
    state.activeBoatId ?? makeActiveIfNoneSelected ?? boats[0]?.uuid ?? null;
  useUiStore.setState({ boats, activeBoatId });
  // Best-effort write of activeBoatId pref if we just chose one.
  if (state.activeBoatId == null && activeBoatId != null) {
    void setPref(PREF_ACTIVE_BOAT_ID, activeBoatId);
  }
}

/** Selector helper: returns the active boat, if any. */
export function selectActiveBoat(): BoatProfile | null {
  const { boats, activeBoatId } = useUiStore.getState();
  return boats.find((b) => b.uuid === activeBoatId) ?? null;
}

/** React hook variant for components. */
export function useActiveBoat(): BoatProfile | null {
  return useUiStore((s) => s.boats.find((b) => b.uuid === s.activeBoatId) ?? null);
}
