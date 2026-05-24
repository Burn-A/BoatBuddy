# BoatBuddy

A mobile-first trip planner for recreational boaters. BoatBuddy gives you on-the-water GPS navigation, near-real-time water depth and wave data, marina and harbor information, and an adaptive ETA based on your specific boat's performance — all in a fast, Google-Maps-style interface.

> **Status:** M4 — Live data. Requirements ([`SRS.md`](./SRS.md)) and architecture ([`ARCHITECTURE.md`](./ARCHITECTURE.md)) are in place. The Next.js app boots a Mapbox map with live GPS vessel position, side menu, unit preferences, course-up compass, and a 54-boat library backed by IndexedDB. A Next.js BFF proxies NOAA CO-OPS (tides) and NDBC (wave buoys) behind a TTL-cached server layer; the client uses TanStack Query to render tappable station overlays with bottom-sheet detail cards showing latest water level, next high/low, sig-wave height, wind, and a freshness badge. Marinas and routing land in M5–M6.

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
| **Route Quick Info** | One-tap summary panel for a plotted route: ETA, distance, fuel needed, minimum starting fuel (from boat specs), max wave height along the route, and any active weather warnings. |

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
7. **M7 — Route Quick Info**: One-tap trip summary panel (ETA, fuel, wave height, weather warnings) surfaced after a destination is set.
8. **M8 — Offline + polish**: Tile caching, PWA install, accessibility audit.

### Stretch Goals (Post-v1)

- **Inclement weather awareness**: Integrate marine weather forecasts (NOAA NWS marine zone forecasts, wind/gust overlays, small-craft advisory alerts) directly into trip planning and routing. When plotting a route, the system would surface active weather warnings for the planned area and time window, suggest departure-time adjustments based on forecast conditions, and flag segments of the route that pass through advisory zones. See SRS §3.7 for detailed requirements.

## License

MIT (intended)

## About

Built as a portfolio demonstration of rapid, structured product development using AI-assisted engineering. Source available on GitHub.
