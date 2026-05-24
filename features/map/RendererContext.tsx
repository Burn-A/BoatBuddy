'use client';

/**
 * React context that surfaces the live MapRenderer to components below
 * MapView in the tree (the side menu, primarily).
 *
 * Kept tiny and focused so it stays out of Zustand — the renderer is
 * non-serializable and has its own lifecycle.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { MapRenderer } from './renderer';

const RendererContext = createContext<MapRenderer | null>(null);

export function RendererProvider({
  renderer,
  children,
}: {
  renderer: MapRenderer | null;
  children: ReactNode;
}) {
  return <RendererContext.Provider value={renderer}>{children}</RendererContext.Provider>;
}

export function useRenderer(): MapRenderer | null {
  return useContext(RendererContext);
}
