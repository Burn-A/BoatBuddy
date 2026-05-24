'use client';

/**
 * Generic bottom sheet.
 *
 * Intentionally minimal — opens from the bottom, fills the lower portion
 * of the screen on mobile, becomes a centered dialog on wider viewports.
 * No drag handle in M4; a later UX pass can add a drag-to-dismiss.
 */

import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close detail"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        tabIndex={open ? 0 : -1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl transition-transform sm:bottom-6 sm:rounded-2xl',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="text-base font-semibold">{title ?? 'Details'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid min-h-touch min-w-touch place-items-center rounded-full hover:bg-surface-muted"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 text-sm">{children}</div>
      </div>
    </>
  );
}
