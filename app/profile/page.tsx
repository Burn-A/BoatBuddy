/**
 * Boat library route.
 *
 * The server shell is kept tiny; all interactivity lives in the
 * BoatLibrary client component, which reads from the Zustand store
 * hydrated by the map view on first load.
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BoatLibrary } from './BoatLibrary';

export default function ProfilePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-12 pt-3">
      <header className="flex items-center gap-2 py-2">
        <Link
          href="/"
          aria-label="Back to map"
          className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-semibold">My boats</h1>
      </header>
      <BoatLibrary />
    </main>
  );
}
