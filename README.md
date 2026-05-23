# BoatBuddy

A mobile-first trip planner for recreational boaters. BoatBuddy gives you on-the-water GPS navigation, near-real-time water depth and wave data, marina and harbor information, and an adaptive ETA based on your specific boat's performance — all in a fast, Google-Maps-style interface.

> **Status:** Planning phase. This repository currently contains the software requirements ([`SRS.md`](./SRS.md)) and the software architecture ([`ARCHITECTURE.md`](./ARCHITECTURE.md)). Implementation has not started.

---

## Why BoatBuddy

Most consumer mapping apps treat the water as an empty blue void. Dedicated marine apps exist (Navionics, Aqua Map, Argo) but are typically paid, desktop-heavy, or vendor-locked to specific chartplotter hardware. BoatBuddy is a lightweight, web-based alternative that runs on any phone or tablet browser, pulls public NOAA data, and adapts its ETA to *your* boat — not a generic average.

## Feature Summary

| Feature | What it does |
|---|---|
| **Marine GPS navigation** | Vector marine charts with vessel position, heading, course-up rotation. |
| **Daily water-level / depth** | Pulls NOAA CO-OPS station data; overlays current depths against charted soundings. |
| **Wave conditions** | NDBC buoy data rendered as overlays; nearest-buoy lookup for any tapped location. |
| **Boat profile + specs** | Pick from a curated seed database (Sea Ray, Boston Whaler, Yamaha, etc.) or enter custom specs (LOA, beam, draft, engine, cruise speed, fuel burn). |
| **Adaptive ETA** | ETA recalculates continuously from live GPS speed, distance remaining, and fuel-burn-aware cruise speed. |
| **Marinas & harbors** | Slip availability, fuel (gas/diesel), pumpout, food, contact info. |
| **Navigation aids** | Buoys, daymarks, hazards, restricted areas, no-wake zones from NOAA ENC data. |

Full functional and non-functional requirements live in [`SRS.md`](./SRS.md).

## Tech Stack (Summary)

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Mapping:** Mapbox GL JS with custom NOAA-derived marine overlays
- **State:** Zustand (UI state) + TanStack Query (server data + cache)
- **Data sources:** NOAA CO-OPS (tides/water levels), NOAA NDBC (waves/buoys), NOAA ENC (charts/aids to navigation), Mapbox (base tiles)
- **Backend:** Next.js Route Handlers as a thin BFF (Backend-for-Frontend) that proxies and caches NOAA responses
- **Persistence:** IndexedDB (client) for boat profiles, recent trips, offline tiles; PostgreSQL + Prisma (server, optional) for sync
- **Hosting:** Vercel (frontend + edge functions)
- **Testing:** Vitest (unit), Playwright (e2e)

Architecture decisions, alternatives considered, and tradeoffs are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Repository Layout (Planned)

```
boatbuddy/
├── README.md              ← you are here
├── SRS.md                 ← functional + non-functional requirements
├── ARCHITECTURE.md        ← architectural decisions and diagrams
├── app/                   ← Next.js App Router
│   ├── (map)/             ← primary map view (route group)
│   ├── api/               ← BFF route handlers (proxied NOAA calls)
│   └── profile/           ← user/boat profile screens
├── components/            ← presentational React components
├── features/              ← feature-sliced modules (navigation, weather, marinas, boat)
├── lib/                   ← shared utilities (units, geo, ETA calc)
├── data/                  ← seed boat database (JSON)
└── public/                ← static assets, icons, marine sprites
```

## Running Locally (Future)

Once implementation begins:

```bash
pnpm install
cp .env.example .env.local   # add MAPBOX_TOKEN
pnpm dev
```

## Roadmap

1. **M1 — Planning** *(this commit)*: SRS, architecture, requirements baseline.
2. **M2 — Map shell**: Mapbox vector map with vessel position and basic UI chrome.
3. **M3 — Boat profile**: Seed database, profile CRUD, persistence in IndexedDB.
4. **M4 — Live data**: NOAA tide/wave overlays, BFF caching layer.
5. **M5 — ETA + routing**: Great-circle routing, adaptive ETA from boat specs.
6. **M6 — Marinas**: Harbor/marina layer with detail cards.
7. **M7 — Offline + polish**: Tile caching, PWA install, accessibility audit.

## License

MIT (intended)

## About

Built as a portfolio demonstration of rapid, structured product development using AI-assisted engineering. Source available on GitHub.
