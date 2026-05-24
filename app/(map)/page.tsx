/**
 * Map view (server shell).
 *
 * This is a server component intentionally: it streams the page chrome
 * (HTML skeleton, metadata) immediately while the heavy client-only
 * MapView hydrates. The pattern minimizes Time-to-Interactive on the
 * map route (NFR-001).
 */

import { MapView } from './MapView';

export default function Page() {
  return (
    <main className="relative h-dvh w-dvw overflow-hidden">
      <MapView />
    </main>
  );
}
