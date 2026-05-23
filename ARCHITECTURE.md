# BoatBuddy — Software Architecture

**Version:** 1.0 (Planning Baseline)
**Date:** 2026-05-23
**Companion to:** [`SRS.md`](./SRS.md)

This document describes the architecture of BoatBuddy at the levels relevant for planning: context, containers, components, and the major cross-cutting concerns (data, state, offline, deployment). Detailed designs (class-level UML, exhaustive sequence diagrams) are intentionally deferred per project direction.

---

## 1. Architectural Goals & Drivers

Derived from the SRS non-functional requirements:

| Driver | Source | Architectural Implication |
|---|---|---|
| Fast first paint and snappy interactions | NFR-001, NFR-002, NFR-005 | Lean client bundle, server-side rendering for shell, vector tiles, aggressive caching at the BFF. |
| Tolerant of bad networks | NFR-020 | Offline-capable PWA, IndexedDB for state, stale-while-revalidate at every layer. |
| Marine-accurate data without paid feeds | Project constraint | NOAA public APIs, pre-processed ENC tiles, OpenStreetMap-derived marina dataset. |
| Sunlight legibility & one-thumb UX | NFR-011, NFR-012 | Mobile-first layout, high-contrast palette, Google-Maps-style chrome (top search, bottom sheets, FABs). |
| Public-repo portfolio piece | Stated by user | Clean module boundaries, conventional commits, tests, no proprietary dependencies. |

---

## 2. Mapping Stack: Decision and Tradeoff Analysis

This is the single highest-leverage decision in the architecture, so it gets its own section.

### 2.1 Decision

**Mapbox GL JS + NOAA public APIs.**

### 2.2 Why this combination

**Why Mapbox GL JS as the renderer.** Marine cartography needs to look right at every zoom level: depth contours legible, AToN symbols readable, smooth rotation for course-up display, and the ability to swap entire chart styles (street view ↔ nautical view) without re-fetching tiles. Mapbox GL is a WebGL vector renderer — it ships smooth pan/zoom/tilt at 60 fps on mid-tier mobile hardware, supports custom style layers (which is how we'll inject NOAA-derived overlays), and exposes a well-documented feature-state API for the interactive elements (tapping a buoy, highlighting a route). It is also the de-facto reference renderer for the MapLibre fork, so if licensing ever becomes painful we have a drop-in escape hatch (MapLibre GL JS is API-compatible).

**Why NOAA for marine data.** NOAA publishes the authoritative U.S. marine dataset — CO-OPS for tides and water levels, NDBC for buoy observations, and ENC for vector nautical charts. The APIs are free, unauthenticated, and they are the same data sources commercial apps like Aqua Map use under the hood. This gives BoatBuddy real-grade marine information without paid licensing, while still being honest with the user via the "not for primary navigation" disclaimer (NFR-033).

**The seam.** Mapbox handles "where is everything on a 2D surface," NOAA handles "what is true about the water there right now." The BFF (described in §3) stitches them together by pre-processing ENC into Mapbox-compatible vector tiles at build time and proxying live NOAA observations at runtime.

### 2.3 Alternatives considered

#### Alternative A — Leaflet + OpenSeaMap + NOAA

Leaflet is a raster/SVG-based map library; OpenSeaMap is a community marine overlay built on OpenStreetMap.

*Pros.* Fully open-source, no API key required, infinitely deployable. OpenSeaMap is a single-tile-URL overlay that's trivial to add. Lower learning curve for contributors.

*Cons.* Raster rendering means jaggy text on rotation, no native 3D tilt, and noticeably less smooth pan/zoom on mobile — measurable on the 55 fps target in NFR-002. OpenSeaMap's data quality is inconsistent globally (great in northern Europe, patchy in the U.S.). No first-class API for styling individual features ("color this buoy red if I tap it") — you fight the framework to do feature-state interactions. End result: it works but looks and feels dated, which directly violates the "modern look" and "very fast response time" goals.

*When this would win.* If we needed a fully FOSS stack with no third-party SaaS dependency, or if Mapbox's free tier became insufficient and self-hosting tiles became necessary. We keep this option open by isolating the renderer behind a thin facade (`features/map/renderer.ts`), so swapping to MapLibre or Leaflet later is mechanical, not architectural.

#### Alternative B — Google Maps JavaScript API + NOAA

The user mentioned wanting a "Google Maps feel," so it's worth being explicit about why we are *not* using actual Google Maps.

*Pros.* Most familiar interaction model in the world; users will instantly know how to use it. Excellent place-search and geocoding. Reliable at any scale.

*Cons.* Google Maps has effectively zero native marine support. There are no nautical charts, no buoys, no aids to navigation, no charted depths, no marina data — the entire reason a boater would open a marine app is missing. You'd be drawing every single marine overlay on top of Google's base layer manually, which means you're using ~10% of Google Maps and paying for 100% of it. Additionally, the Google Maps Platform is a paid service with usage-based billing once free credits are exhausted, which conflicts with the "no paid third-party APIs" v1 constraint. Custom marker styling and feature interactions are more constrained than Mapbox GL, and Google Maps does not expose a vector style spec, so we can't deliver the nautical-chart look the SRS calls for.

*The Google Maps "feel" without Google Maps.* We get the familiarity by copying the *interaction pattern*: a top search bar, a hamburger drawer on the left, a layer FAB on the right, and bottom sheets for detail cards. That pattern is the part users recognize; the underlying tile provider can be anyone.

#### Alternative C — Native chartplotter SDKs (Navionics, C-MAP)

*Pros.* Best-in-class chart data.
*Cons.* Closed, paid, no public web SDK, would require partnership agreements. Hard "no" for a portfolio project.

### 2.4 Risks of the chosen stack

- **Mapbox free-tier limit (50k map loads/month).** Acceptable for portfolio-scale traffic; we'll add usage tracking in M4 and switch to MapLibre + self-hosted tiles if usage approaches the cap. The renderer facade makes this swap a one-week job, not a rewrite.
- **ENC pre-processing complexity.** NOAA ENC is delivered as S-57 files, which require conversion to GeoJSON/MBTiles. Mitigation: build-time job using GDAL + `tippecanoe`, output static tiles served from `public/` or a CDN.
- **NDBC freshness gaps.** Some buoys go offline seasonally. Mitigation: always show observation timestamp and a "stale" badge after 1 h.

---

## 3. System Context (C4 Level 1)

```
                         ┌──────────────────┐
                         │  Recreational    │
                         │  Boater (phone   │
                         │  or tablet)      │
                         └────────┬─────────┘
                                  │ HTTPS
                                  ▼
                       ┌──────────────────────┐
                       │     BoatBuddy        │
                       │     PWA + BFF        │
                       │   (Vercel hosted)    │
                       └────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   ┌─────────┐           ┌────────────┐         ┌───────────────┐
   │ Mapbox  │           │   NOAA     │         │ OpenStreetMap │
   │ tiles + │           │ CO-OPS /   │         │ (marinas via  │
   │ GL JS   │           │ NDBC / ENC │         │   Overpass)   │
   └─────────┘           └────────────┘         └───────────────┘
```

The user only ever talks to BoatBuddy. BoatBuddy talks to Mapbox directly from the client (tiles need to load fast), and to NOAA and OSM only through the BFF (so we can cache and shape responses).

---

## 4. Container Diagram (C4 Level 2)

```
┌───────────────────────── BoatBuddy ──────────────────────────────┐
│                                                                  │
│  ┌─────────────────────┐         ┌──────────────────────────┐    │
│  │   Browser Client    │  HTTP   │  Next.js Route Handlers  │    │
│  │ (Next.js, React,    │ ◄─────► │  (BFF — Edge runtime)    │    │
│  │  Mapbox GL JS)      │         │                          │    │
│  └──────────┬──────────┘         └──────────┬───────────────┘    │
│             │                               │                    │
│             │ IndexedDB                     │                    │
│             ▼                               ▼                    │
│      ┌────────────┐               ┌──────────────────┐           │
│      │ Local Store│               │ Upstash Redis    │           │
│      │ (boats,    │               │ (NOAA response   │           │
│      │  prefs,    │               │  cache, 15–60min)│           │
│      │  tiles)    │               └──────────────────┘           │
│      └────────────┘                                              │
│                                                                  │
│      ┌────────────────────────────────────────────────┐          │
│      │  Optional: Postgres (Neon) + Prisma            │          │
│      │  Only if user opts into account sync           │          │
│      └────────────────────────────────────────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

The **client** is a Next.js App Router application rendered server-side for the shell and hydrated on the device. The map view is a client component because Mapbox GL JS needs the DOM.

The **BFF** is a thin layer of Next.js Route Handlers running on Vercel Edge. It exists for three reasons:
1. Keep NOAA upstream traffic low via a shared cache (Upstash Redis).
2. Shape NOAA's heterogeneous payloads into one consistent JSON contract the client can consume.
3. Hide cross-origin and rate-limit concerns from the browser.

The **local store** (IndexedDB via `idb`) is the source of truth for user-owned data — boat profiles, layer preferences, cached tiles. Server sync (if/when implemented per FR-041) is additive.

---

## 5. Component Layout (C4 Level 3)

```
app/
├── (map)/                    Route group for the primary map view
│   ├── page.tsx              Server component: shell, metadata
│   └── MapView.tsx           Client component: hosts Mapbox
├── api/
│   ├── tides/route.ts        BFF: NOAA CO-OPS proxy
│   ├── waves/route.ts        BFF: NDBC proxy
│   ├── marinas/route.ts      BFF: OSM Overpass proxy
│   └── search/route.ts       BFF: place search
└── profile/
    └── page.tsx              Boat profile management

features/                     Feature-sliced modules
├── map/
│   ├── renderer.ts           Thin Mapbox facade (the swap point)
│   ├── layers/
│   │   ├── aton.ts           Aids to navigation
│   │   ├── hazards.ts
│   │   ├── depth.ts
│   │   └── marinas.ts
│   └── controls/             Layer toggle, compass, zoom
├── navigation/
│   ├── route.ts              Great-circle math, route line
│   ├── eta.ts                Adaptive ETA calculator (pure)
│   └── vessel.ts             Geolocation watcher
├── weather/
│   ├── tides.ts              CO-OPS client
│   └── waves.ts              NDBC client
└── boat/
    ├── profile.ts            CRUD + active boat selector
    ├── seedDb.ts             Loader for data/boats.json
    └── fuelRange.ts          Range/fuel-burn math

lib/                          Cross-feature utilities
├── geo.ts                    Distance, bearing, projection helpers
├── units.ts                  nm↔mi↔km, kn↔mph↔km/h, ft↔m
├── storage.ts                IndexedDB wrapper (typed)
├── http.ts                   Fetch wrapper with retry + abort
└── time.ts                   Format, freshness badges

components/                   Pure presentational React
├── ui/                       shadcn primitives (Button, Sheet, ...)
├── BottomSheet.tsx
├── SideMenu.tsx
├── SearchBar.tsx
└── LayerFab.tsx

data/
└── boats.json                Seed database (≥ 50 models)
```

The boundary that matters most: anything inside `features/*/` may import from `lib/*` and `components/*`, but `features/` modules **never import each other directly**. Cross-feature coordination happens through the global Zustand store (§7) or through props at the page level. This keeps each feature deletable without ripple.

---

## 6. Data Flow Examples

### 6.1 Map opens (cold)
1. User hits `/`. Next.js streams the shell HTML (search bar, side menu, FAB chrome) — no Mapbox JS yet.
2. `MapView.tsx` hydrates on the client, lazy-imports `mapbox-gl`, initializes the renderer.
3. Geolocation watcher starts; first fix re-centers the map.
4. TanStack Query fires three parallel BFF calls — `/api/tides`, `/api/waves`, `/api/marinas` — scoped to the current bounds. Each call is cached at the BFF.
5. As data arrives, layer modules push features into Mapbox source/layer objects.

### 6.2 User taps a buoy
1. Mapbox click handler reads `feature.properties.stationId` from feature-state.
2. Client checks TanStack Query cache for that station's detail; cache miss triggers `/api/waves/{stationId}`.
3. Bottom sheet opens with the rendered detail card and freshness badge.

### 6.3 User sets a destination
1. Long-press → `features/navigation/route.ts` computes the great-circle line and total distance via `lib/geo.ts`.
2. `features/navigation/eta.ts` reads active boat's cruise speed from the Zustand store and computes ETA. If GPS speed is live and above a threshold, it uses GPS speed instead.
3. Route line is rendered as a Mapbox source; ETA is shown in a persistent header pill that updates on every GPS tick.

---

## 7. State Management

Two stores, one rule per store.

**Zustand (UI/domain state).** Active boat, current destination, layer visibility, side-menu open state, units. Lives only in memory; rehydrated from IndexedDB on app start. This is the state the React tree subscribes to.

**TanStack Query (server state).** Every BFF response. Configured with `staleTime` per resource (tides 1 h, waves 30 min, marinas 24 h, search 5 min) and `gcTime` of 24 h so back-button feels instant. Query keys include the bounding box hash so we don't refetch on minor pan jitter.

This split is deliberate: confusing client UI state with cached server data is the single most common cause of stale-UI bugs in React apps, so we keep them in different stores with different APIs.

---

## 8. Offline Strategy

Three layers, each handles a different failure mode:

| Layer | Handles | Mechanism |
|---|---|---|
| Service Worker | App shell + JS bundles | Workbox precache, network-first for HTML, cache-first for hashed assets. |
| Tile cache | Map tiles for a chosen region | User-initiated download into Cache Storage, bounded to a bbox (FR-042). |
| IndexedDB | User data + last-good NOAA data | `idb` wrapper; every successful BFF response is mirrored into IndexedDB with a TTL. |

When offline, the BFF clients first try cache, then IndexedDB last-good, then surface a "you're offline — showing last known data" badge.

---

## 9. Security & Privacy

- Mapbox token is scoped to `boatbuddy.app` (and `localhost` for dev) and injected via Next.js `env.NEXT_PUBLIC_MAPBOX_TOKEN`. Read scopes only; never a secret token in the client.
- All NOAA calls go through the BFF, so the client never makes cross-origin requests to NOAA directly (cleaner CSP, easier rate-limit handling).
- The CSP locks script sources to self, Mapbox CDN, and Vercel analytics.
- Geolocation data is processed entirely on-device for anonymous users. Only opt-in account holders have any data persisted server-side; that flow uses a magic-link email auth (passwordless) and stores only what's necessary to sync boats.
- No third-party trackers in v1.
- "Not for primary navigation" disclaimer on first launch + in the About screen.

---

## 10. Deployment & Operations

**Hosting.** Vercel for the Next.js app and Edge route handlers. Upstash Redis (serverless) for BFF caching. Neon Postgres only if/when account sync ships.

**CI/CD.** GitHub Actions: lint → typecheck → unit tests → e2e (Playwright on a Vercel preview deploy) → deploy on merge to `main`.

**Observability.** Vercel Analytics for Core Web Vitals; Sentry for client and server errors. NOAA upstream call counts and cache hit rate logged to Vercel logs.

**Environments.** `local` → `preview` (per PR) → `production` on `boatbuddy.app`.

---

## 11. Technology Choices: Summary Table

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Project mandate; great mobile perf; built-in route handlers for the BFF. |
| Language | TypeScript (strict) | Type safety on a domain with lots of unit-y values (knots, meters, fathoms). |
| Renderer | Mapbox GL JS | §2.1. |
| Styling | Tailwind + shadcn/ui | Fast iteration; consistent component primitives; accessible by default. |
| UI state | Zustand | Tiny, no context boilerplate, easy to persist a slice to IndexedDB. |
| Server state | TanStack Query | Best-in-class cache invalidation and stale-while-revalidate. |
| Local storage | IndexedDB via `idb` | Async, structured, large quota. |
| Offline | Workbox + custom tile cache | Mature SW tooling; bounded tile cache fits FR-042. |
| Tests | Vitest + Playwright | Vitest for `lib/`; Playwright for the map view smoke test. |
| Hosting | Vercel | First-class Next.js + edge route handlers. |
| Cache | Upstash Redis | Serverless, pay-per-use, fits Vercel Edge runtime. |

---

## 12. What's Deliberately Not Decided Yet

Per project direction, detailed designs are deferred. Specifically, these are open until M2+:

- Exact component hierarchy inside `MapView.tsx`.
- Database schema if/when account sync ships (FR-041 is a "Could").
- Marina detail data shape — depends on what OSM tags are actually populated for U.S. marinas.
- Exact freshness UI treatment (color + copy of the stale-data badge).
- Internationalization strategy (English-only at launch).

These will be added as ADRs (Architecture Decision Records) in `docs/adr/` once their constraints are concrete.
