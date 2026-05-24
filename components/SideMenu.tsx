'use client';

/**
 * Left-edge slide-in side menu (FR-050).
 *
 * Hosts: active boat selector (stub in M2), unit preferences (FR-051),
 * about/disclaimer. Boat library CRUD lands in M3.
 */

import Link from 'next/link';
import { useEffect } from 'react';
import { X, Anchor, Ruler, Info, CloudDownload } from 'lucide-react';
import { useUiStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import type { DistanceUnit, SpeedUnit, DepthUnit } from '@/lib/units';
import { BoatBadge } from './BoatBadge';
import { SaveOfflineButton } from './SaveOfflineButton';

export function SideMenu() {
  const open = useUiStore((s) => s.sideMenuOpen);
  const setOpen = useUiStore((s) => s.setSideMenuOpen);
  const units = useUiStore((s) => s.units);
  const setUnits = useUiStore((s) => s.setUnits);

  // Escape closes the drawer (NFR-013 keyboard nav).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-30 bg-black/30 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        tabIndex={open ? 0 : -1}
      />

      {/* Drawer */}
      <aside
        aria-label="Main menu"
        aria-hidden={!open}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[320px] max-w-[85vw] flex-col bg-surface shadow-2xl transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="text-base font-semibold">BoatBuddy</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          <Section icon={<Anchor className="h-4 w-4" />} title="Boat">
            <BoatBadge />
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex min-h-touch items-center justify-center rounded-lg bg-surface-muted px-3 text-sm font-medium hover:bg-neutral-200"
            >
              Manage boats
            </Link>
          </Section>

          <Section icon={<Ruler className="h-4 w-4" />} title="Units">
            <UnitPicker
              label="Distance"
              value={units.distance}
              options={[
                ['nm', 'Nautical miles'],
                ['mi', 'Miles'],
                ['km', 'Kilometers'],
              ]}
              onChange={(v) => setUnits({ distance: v as DistanceUnit })}
            />
            <UnitPicker
              label="Speed"
              value={units.speed}
              options={[
                ['kn', 'Knots'],
                ['mph', 'mph'],
                ['kmh', 'km/h'],
              ]}
              onChange={(v) => setUnits({ speed: v as SpeedUnit })}
            />
            <UnitPicker
              label="Depth"
              value={units.depth}
              options={[
                ['ft', 'Feet'],
                ['m', 'Meters'],
              ]}
              onChange={(v) => setUnits({ depth: v as DepthUnit })}
            />
          </Section>

          <Section icon={<CloudDownload className="h-4 w-4" />} title="Offline">
            <SaveOfflineButton />
            <p className="text-xs text-neutral-500">
              Caches map tiles for the current view so they load without a network. The
              app shell is always cached after first visit.
            </p>
          </Section>

          <Section icon={<Info className="h-4 w-4" />} title="About">
            <p className="text-neutral-500">
              BoatBuddy is a planning aid only. Not for primary navigation. Always carry
              charted paper maps, a compass, and certified marine electronics.
            </p>
          </Section>
        </nav>
      </aside>
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 flex items-center gap-2 font-medium text-neutral-700">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function UnitPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-neutral-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-touch rounded border border-black/10 bg-white px-2 py-1 text-sm"
      >
        {options.map(([k, lbl]) => (
          <option key={k} value={k}>
            {lbl}
          </option>
        ))}
      </select>
    </label>
  );
}
