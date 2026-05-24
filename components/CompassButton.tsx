'use client';

/**
 * Course-up / north-up toggle (FR-003).
 */

import { Compass } from 'lucide-react';
import { useUiStore } from '@/lib/store';
import { cn } from '@/lib/cn';

export function CompassButton() {
  const courseUp = useUiStore((s) => s.courseUp);
  const setCourseUp = useUiStore((s) => s.setCourseUp);

  return (
    <button
      type="button"
      aria-label={courseUp ? 'Switch to north-up' : 'Switch to course-up'}
      aria-pressed={courseUp}
      onClick={() => setCourseUp(!courseUp)}
      className={cn(
        'grid h-12 w-12 place-items-center rounded-full shadow-md ring-1 ring-black/5',
        courseUp ? 'bg-chart-route text-white' : 'bg-white text-neutral-700 hover:bg-surface-muted',
      )}
    >
      <Compass className="h-5 w-5" aria-hidden />
    </button>
  );
}
