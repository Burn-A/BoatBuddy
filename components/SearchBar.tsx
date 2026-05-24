'use client';

/**
 * Top search bar (FR-052).
 *
 * M2 scope is structural — the input fires no search query yet. M4 will
 * wire this to /api/search. The component intentionally mirrors the
 * Google Maps placement: pinned top, full-width, with a leading
 * hamburger that toggles the side menu.
 */

import { Menu, Search } from 'lucide-react';
import { useUiStore } from '@/lib/store';
import { cn } from '@/lib/cn';

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const setSideMenuOpen = useUiStore((s) => s.setSideMenuOpen);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-md ring-1 ring-black/5',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setSideMenuOpen(true)}
        className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <Search className="h-4 w-4 text-neutral-500" aria-hidden />
      <input
        type="search"
        placeholder="Search harbors, marinas, places"
        aria-label="Search the map"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
      />
    </div>
  );
}
