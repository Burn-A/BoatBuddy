'use client';

/**
 * Inline editor for a BoatProfile (FR-023).
 *
 * Designed mobile-first as a vertical list of labeled inputs grouped
 * by concern. The form is uncontrolled per-field at the local level
 * (we keep a `draft` state object) and only persists on Save.
 */

import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import type { BoatProfile, Category, EngineType, FuelType } from '@/features/boat/types';
import { updateBoat, deleteBoatProfile } from '@/features/boat/profile';

interface BoatEditorProps {
  boat: BoatProfile;
  onSaved?: (b: BoatProfile) => void;
  onDeleted?: () => void;
}

const CATEGORIES: Category[] = [
  'center-console',
  'cruiser',
  'bowrider',
  'pontoon',
  'sailboat',
  'trawler',
  'jet',
  'other',
];
const ENGINES: EngineType[] = ['outboard', 'sterndrive', 'inboard', 'jet', 'sail-aux'];
const FUELS: FuelType[] = ['gasoline', 'diesel', 'electric'];

export function BoatEditor({ boat, onSaved, onDeleted }: BoatEditorProps) {
  const [draft, setDraft] = useState<BoatProfile>(boat);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof BoatProfile>(key: K, value: BoatProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const next = await updateBoat(boat.uuid, draft);
      if (next) onSaved?.(next);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${draft.displayName}"? This cannot be undone.`)) return;
    await deleteBoatProfile(boat.uuid);
    onDeleted?.();
  }

  return (
    <div className="space-y-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <Group title="Identity">
        <Text label="Display name" value={draft.displayName} onChange={(v) => update('displayName', v)} />
        <Row>
          <Text label="Manufacturer" value={draft.manufacturer} onChange={(v) => update('manufacturer', v)} />
          <Text label="Model" value={draft.model} onChange={(v) => update('model', v)} />
        </Row>
        <Select
          label="Category"
          value={draft.category}
          options={CATEGORIES}
          onChange={(v) => update('category', v as Category)}
        />
      </Group>

      <Group title="Hull">
        <Row>
          <NumberField label="LOA (ft)" value={draft.loaFt} onChange={(v) => update('loaFt', v)} step={0.1} />
          <NumberField label="Beam (ft)" value={draft.beamFt} onChange={(v) => update('beamFt', v)} step={0.1} />
        </Row>
        <Row>
          <NumberField label="Draft (ft)" value={draft.draftFt} onChange={(v) => update('draftFt', v)} step={0.1} />
          <NumberField
            label="Displacement (lbs)"
            value={draft.displacementLbs}
            onChange={(v) => update('displacementLbs', v)}
          />
        </Row>
      </Group>

      <Group title="Propulsion">
        <Row>
          <Select
            label="Engine type"
            value={draft.engineType}
            options={ENGINES}
            onChange={(v) => update('engineType', v as EngineType)}
          />
          <NumberField label="Total HP" value={draft.totalHp} onChange={(v) => update('totalHp', v)} />
        </Row>
        <Row>
          <NumberField
            label="Cruise speed (kn)"
            value={draft.cruiseSpeedKn}
            onChange={(v) => update('cruiseSpeedKn', v)}
            step={0.5}
          />
          <NumberField
            label="Max speed (kn)"
            value={draft.maxSpeedKn}
            onChange={(v) => update('maxSpeedKn', v)}
            step={0.5}
          />
        </Row>
      </Group>

      <Group title="Fuel">
        <Row>
          <Select
            label="Fuel type"
            value={draft.fuelType}
            options={FUELS}
            onChange={(v) => update('fuelType', v as FuelType)}
          />
          <NumberField
            label="Capacity (gal)"
            value={draft.fuelCapacityGal}
            onChange={(v) => update('fuelCapacityGal', v)}
          />
        </Row>
        <Row>
          <NumberField
            label="Burn at cruise (gph)"
            value={draft.fuelBurnGph}
            onChange={(v) => update('fuelBurnGph', v)}
            step={0.1}
          />
          <NumberField
            label="Current fuel (gal)"
            value={draft.currentFuelGal ?? 0}
            onChange={(v) => update('currentFuelGal', v === 0 ? undefined : v)}
            step={0.5}
          />
        </Row>
      </Group>

      <Group title="Notes">
        <textarea
          value={draft.notes ?? ''}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          className="w-full rounded border border-black/10 bg-white px-2 py-1.5 text-sm"
          placeholder="Prop pitch, electronics, anything else"
        />
      </Group>

      <div className="flex items-center justify-between border-t border-black/5 pt-3">
        <button
          type="button"
          onClick={remove}
          className="flex min-h-touch items-center gap-1.5 rounded px-2 text-sm text-chart-buoyRed hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex min-h-touch items-center gap-1.5 rounded bg-chart-route px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden /> {saving ? 'Saving' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/* ───────── tiny field primitives — local, not exported ───────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-touch rounded border border-black/10 bg-white px-2 text-sm"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) =>
          onChange(e.target.value === '' ? 0 : Number.parseFloat(e.target.value))
        }
        className="min-h-touch rounded border border-black/10 bg-white px-2 text-sm"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-touch rounded border border-black/10 bg-white px-2 text-sm capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace('-', ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}
