/**
 * Seed-database accessor.
 *
 * The JSON file is statically imported so it ships in the client bundle.
 * At ~54 records (~10 KB minified) this is negligible against the
 * 250 KB initial-JS budget (NFR-005) and avoids a network hop for what
 * is effectively a constant.
 */

import seedJson from '@/data/boats.json';
import type { BoatSeed, Category } from './types';

interface SeedFile {
  _meta: { schemaVersion: number; notice: string; count: number };
  boats: BoatSeed[];
}

const SEED = seedJson as SeedFile;

export function getAllSeedBoats(): BoatSeed[] {
  return SEED.boats;
}

export function getSeedBoat(id: string): BoatSeed | undefined {
  return SEED.boats.find((b) => b.id === id);
}

export function searchSeeds(query: string, category?: Category): BoatSeed[] {
  const q = query.trim().toLowerCase();
  return SEED.boats.filter((b) => {
    if (category && b.category !== category) return false;
    if (!q) return true;
    return (
      b.manufacturer.toLowerCase().includes(q) ||
      b.model.toLowerCase().includes(q) ||
      `${b.manufacturer} ${b.model}`.toLowerCase().includes(q)
    );
  });
}

export const SEED_DISCLAIMER = SEED._meta.notice;
