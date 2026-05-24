'use client';

/**
 * Detail card for a tapped tide station or wave buoy.
 *
 * Lives inside the bottom sheet. The freshness badge realizes NFR-004
 * — observations older than 1 hour get a visible "stale" indicator.
 */

import { useTideDetail } from '@/features/weather/tides';
import { useWaveDetail } from '@/features/weather/waves';
import { classifyFreshness, formatRelative } from '@/lib/time';
import { depthFromMeters, fromMps } from '@/lib/units';
import { useUiStore, type SelectedFeature } from '@/lib/store';
import { cn } from '@/lib/cn';

interface FeatureDetailProps {
  feature: SelectedFeature;
}

export function FeatureDetail({ feature }: FeatureDetailProps) {
  if (feature.kind === 'tide') return <TideDetail feature={feature} />;
  return <WaveDetail feature={feature} />;
}

function FreshBadge({ timestampMs }: { timestampMs: number }) {
  const f = classifyFreshness(timestampMs, {
    agingAfterMs: 30 * 60_000,
    staleAfterMs: 60 * 60_000,
  });
  const tone =
    f === 'fresh'
      ? 'bg-chart-buoyGreen/10 text-chart-buoyGreen'
      : f === 'aging'
        ? 'bg-chart-hazard/10 text-chart-hazard'
        : 'bg-chart-buoyRed/10 text-chart-buoyRed';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>
      {f === 'fresh' ? 'Live' : f === 'aging' ? 'Aging' : 'Stale'} &middot;{' '}
      {formatRelative(timestampMs)}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

/* ─────────── tide ─────────── */

function TideDetail({ feature }: { feature: SelectedFeature }) {
  const { data, isLoading, isError } = useTideDetail(feature.id);
  const depthUnit = useUiStore((s) => s.units.depth);

  if (isLoading) return <p className="text-sm text-neutral-500">Loading station…</p>;
  if (isError || !data)
    return <p className="text-sm text-chart-buoyRed">Couldn't load tide data.</p>;

  const latest = data.latest;
  const observedMs = latest ? new Date(latest.time).getTime() : null;
  // Convert feet → meters → user depth unit (round-trip is fine for display).
  const latestDepth = latest ? depthFromMeters(latest.feet * 0.3048, depthUnit) : null;
  const depthLabel =
    latestDepth != null ? `${latestDepth.toFixed(1)} ${depthUnit} MLLW` : null;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{feature.name}</h3>
          <p className="text-xs text-neutral-500">Tide station #{feature.id}</p>
        </div>
        {observedMs && <FreshBadge timestampMs={observedMs} />}
      </header>

      <section>
        <Row label="Water level" value={depthLabel} />
        <Row label="Observed" value={latest ? new Date(latest.time).toLocaleString() : null} />
      </section>

      {data.upcoming.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Next high/low
          </h4>
          <ul className="space-y-1">
            {data.upcoming.map((p, idx) => {
              const localTime = new Date(p.time).toLocaleString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                weekday: 'short',
              });
              const depth = depthFromMeters(p.feet * 0.3048, depthUnit).toFixed(1);
              return (
                <li
                  key={idx}
                  className="flex items-baseline justify-between text-sm"
                >
                  <span className={p.type === 'high' ? 'text-chart-route' : 'text-neutral-600'}>
                    {p.type === 'high' ? '↑ High' : '↓ Low'} · {localTime}
                  </span>
                  <span className="font-medium">
                    {depth} {depthUnit}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ─────────── wave buoy ─────────── */

function WaveDetail({ feature }: { feature: SelectedFeature }) {
  const { data, isLoading, isError } = useWaveDetail(feature.id);
  const depthUnit = useUiStore((s) => s.units.depth);
  const speedUnit = useUiStore((s) => s.units.speed);

  if (isLoading) return <p className="text-sm text-neutral-500">Loading buoy…</p>;
  if (isError || !data)
    return <p className="text-sm text-chart-buoyRed">Couldn't load buoy data.</p>;

  const latest = data.latest;
  const observedMs = latest ? new Date(latest.timeUtc).getTime() : null;

  const sigWaveLabel =
    latest?.sigWaveHeightM != null
      ? `${depthFromMeters(latest.sigWaveHeightM, depthUnit).toFixed(1)} ${depthUnit}`
      : null;
  const periodLabel = latest?.dominantPeriodS != null ? `${latest.dominantPeriodS.toFixed(0)} s` : null;
  const windLabel =
    latest?.windSpeedMps != null
      ? `${fromMps(latest.windSpeedMps, speedUnit).toFixed(0)} ${speedUnit === 'kn' ? 'kn' : speedUnit === 'mph' ? 'mph' : 'km/h'}${
          latest.windDirDeg != null ? ` from ${Math.round(latest.windDirDeg)}°` : ''
        }`
      : null;
  const gustLabel =
    latest?.gustMps != null
      ? `${fromMps(latest.gustMps, speedUnit).toFixed(0)} ${speedUnit === 'kn' ? 'kn' : speedUnit === 'mph' ? 'mph' : 'km/h'}`
      : null;
  const waterTempLabel =
    latest?.waterTempC != null ? `${(latest.waterTempC * 1.8 + 32).toFixed(0)} °F` : null;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{feature.name}</h3>
          <p className="text-xs text-neutral-500">NDBC buoy #{feature.id}</p>
        </div>
        {observedMs && <FreshBadge timestampMs={observedMs} />}
      </header>

      <section>
        <Row label="Sig. wave height" value={sigWaveLabel} />
        <Row label="Dominant period" value={periodLabel} />
        <Row label="Wind" value={windLabel} />
        <Row label="Gust" value={gustLabel} />
        <Row label="Water temp" value={waterTempLabel} />
      </section>
    </div>
  );
}
