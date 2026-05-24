'use client';

/**
 * Marina detail card (FR-031).
 *
 * Reads the marina from the same TanStack Query bbox response that
 * powers the map layer, so opening the sheet is instant — no extra
 * network round trip needed.
 */

import { useMemo } from 'react';
import {
  Anchor,
  Check,
  ExternalLink,
  Fuel,
  Phone,
  Plug,
  Radio,
  Store,
  Utensils,
  X,
  Droplet,
  ShowerHead,
} from 'lucide-react';
import { useUiStore } from '@/lib/store';
import { useMarinas } from '@/features/marinas/marinas';
import type { Marina } from '@/lib/osm/marinas';

// Inlined to avoid pulling the server-only Overpass module into the
// client bundle for what is effectively a single constant.
const MARINA_ATTRIBUTION = '© OpenStreetMap contributors';

interface MarinaDetailProps {
  id: string;
}

export function MarinaDetail({ id }: MarinaDetailProps) {
  const bbox = useUiStore((s) => s.bbox);
  const { data, isLoading, isError } = useMarinas(bbox);

  const marina = useMemo<Marina | null>(() => {
    if (!data) return null;
    return data.marinas.find((m) => m.id === id) ?? null;
  }, [data, id]);

  if (isLoading && !marina) return <p className="text-sm text-neutral-500">Loading marina…</p>;
  if (isError) return <p className="text-sm text-chart-buoyRed">Couldn't load marina data.</p>;
  if (!marina) return <p className="text-sm text-neutral-500">Marina not in current view.</p>;

  return (
    <div className="space-y-3">
      <header>
        <h3 className="text-sm font-semibold">{marina.name}</h3>
        {marina.address && <p className="text-xs text-neutral-500">{marina.address}</p>}
      </header>

      {marina.description && (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-neutral-700">
          {marina.description}
        </p>
      )}

      <Section title="Amenities">
        <Amenity icon={<Fuel className="h-4 w-4" />} label="Gasoline" value={marina.hasGasoline} />
        <Amenity icon={<Fuel className="h-4 w-4" />} label="Diesel" value={marina.hasDiesel} />
        {marina.hasGasoline == null && marina.hasDiesel == null && (
          <Amenity icon={<Fuel className="h-4 w-4" />} label="Fuel" value={marina.hasFuel} />
        )}
        <Amenity icon={<Droplet className="h-4 w-4" />} label="Pumpout" value={marina.hasPumpout} />
        <Amenity icon={<Plug className="h-4 w-4" />} label="Shore power" value={marina.hasShorePower} />
        <Amenity icon={<ShowerHead className="h-4 w-4" />} label="Showers" value={marina.hasShowers} />
        <Amenity
          icon={<Anchor className="h-4 w-4" />}
          label="Restrooms"
          value={marina.hasRestrooms}
        />
        <Amenity
          icon={<Utensils className="h-4 w-4" />}
          label="Restaurant"
          value={marina.hasRestaurant}
        />
        <Amenity
          icon={<Store className="h-4 w-4" />}
          label="Marine store"
          value={marina.hasMarineStore}
        />
        {marina.slipCapacity != null && (
          <Row
            icon={<Anchor className="h-4 w-4 text-chart-route" />}
            label="Slip capacity"
            value={`${marina.slipCapacity} berths`}
          />
        )}
      </Section>

      {(marina.phone || marina.website || marina.vhfChannel) && (
        <Section title="Contact">
          {marina.vhfChannel && (
            <Row
              icon={<Radio className="h-4 w-4 text-chart-route" />}
              label="VHF channel"
              value={marina.vhfChannel}
            />
          )}
          {marina.phone && (
            <Row
              icon={<Phone className="h-4 w-4 text-chart-route" />}
              label="Phone"
              value={
                <a className="underline" href={`tel:${marina.phone}`}>
                  {marina.phone}
                </a>
              }
            />
          )}
          {marina.website && (
            <Row
              icon={<ExternalLink className="h-4 w-4 text-chart-route" />}
              label="Website"
              value={
                <a
                  className="underline"
                  href={marina.website}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open ↗
                </a>
              }
            />
          )}
        </Section>
      )}

      <footer className="border-t border-black/5 pt-2 text-[10px] uppercase tracking-wide text-neutral-400">
        {MARINA_ATTRIBUTION}
      </footer>
    </div>
  );
}

/* ─────────── local primitives ─────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h4>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}

function Amenity({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean | null;
}) {
  const tone =
    value === true
      ? 'text-chart-buoyGreen'
      : value === false
        ? 'text-neutral-400'
        : 'text-neutral-400';
  const status =
    value === true ? (
      <Check className="h-4 w-4 text-chart-buoyGreen" aria-label="Available" />
    ) : value === false ? (
      <X className="h-4 w-4 text-neutral-400" aria-label="Not available" />
    ) : (
      <span className="text-xs text-neutral-400">Not listed</span>
    );
  return (
    <li className="flex items-center justify-between">
      <span className={`flex items-center gap-2 text-sm ${tone}`}>
        {icon}
        <span className="text-neutral-700">{label}</span>
      </span>
      {status}
    </li>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm text-neutral-700">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </li>
  );
}
