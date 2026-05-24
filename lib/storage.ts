/**
 * IndexedDB persistence layer.
 *
 * Implements the local-storage half of FR-040 (boat profiles + prefs
 * survive reload). Wraps the native IDBDatabase with the `idb` library
 * for Promise-based ergonomics.
 *
 * Browser-only — never call these from a server component. All exports
 * lazy-open the database so importing this module has no side effects.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { BoatProfile } from '@/features/boat/types';

const DB_NAME = 'boatbuddy';
const DB_VERSION = 1;

interface BoatBuddyDB extends DBSchema {
  boats: {
    key: string;
    value: BoatProfile;
  };
  prefs: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<BoatBuddyDB>> | null = null;

function getDb(): Promise<IDBPDatabase<BoatBuddyDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<BoatBuddyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('boats')) {
          db.createObjectStore('boats', { keyPath: 'uuid' });
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/* ─────────────────── Boats ─────────────────── */

export async function listBoats(): Promise<BoatProfile[]> {
  const db = await getDb();
  return db.getAll('boats');
}

export async function getBoat(uuid: string): Promise<BoatProfile | undefined> {
  const db = await getDb();
  return db.get('boats', uuid);
}

export async function putBoat(boat: BoatProfile): Promise<void> {
  const db = await getDb();
  await db.put('boats', boat);
}

export async function deleteBoat(uuid: string): Promise<void> {
  const db = await getDb();
  await db.delete('boats', uuid);
}

/* ─────────────────── Prefs (singletons) ─────────────────── */

export async function getPref<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get('prefs', key);
  return row?.value as T | undefined;
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put('prefs', { key, value });
}

/* ─────────────────── Convenience ─────────────────── */

export const PREF_ACTIVE_BOAT_ID = 'activeBoatId';
