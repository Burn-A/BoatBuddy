'use client';

/**
 * First-launch disclaimer modal (NFR-033).
 *
 * Shown once per browser until the user explicitly acknowledges. The
 * dismissal flag lives in localStorage — it's not a setting we sync
 * across devices, and showing it again on a new device is the right
 * default for a safety-related notice.
 */

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const STORAGE_KEY = 'bb:disclaimer:v1';

export function Disclaimer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // Private browsing / quota — fail open so the disclaimer still shows.
      setOpen(true);
    }
  }, []);

  // Escape to dismiss (after acknowledgment is a click, but Esc is a
  // reasonable secondary keyboard path once focus is in the modal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') acknowledge();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Fail silently — user will see disclaimer next visit.
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bb-disclaimer-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-chart-hazard" aria-hidden />
          <h2 id="bb-disclaimer-title" className="text-base font-semibold">
            Before you head out
          </h2>
        </div>

        <div className="space-y-2 text-sm text-neutral-700">
          <p>
            BoatBuddy is a <strong>planning aid</strong>. It is not a certified marine
            navigation system and must not be relied upon as your primary navigation
            instrument.
          </p>
          <p>
            Always carry charted paper maps, a compass, a working VHF radio, and certified
            marine electronics. Conditions on the water can change rapidly — verify all
            observations against NOAA, NWS, and US Coast Guard sources.
          </p>
        </div>

        <button
          type="button"
          autoFocus
          onClick={acknowledge}
          className="mt-4 w-full rounded-lg bg-chart-route py-3 text-sm font-medium text-white hover:opacity-90"
        >
          I understand
        </button>
      </div>
    </div>
  );
}
