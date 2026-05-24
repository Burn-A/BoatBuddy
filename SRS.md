# BoatBuddy — Software Requirements Specification

**Version:** 1.0 (Planning Baseline)
**Date:** 2026-05-23
**Status:** Draft for review
**Format:** Adapted from IEEE Std 830-1998

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **BoatBuddy**, a mobile-first web application for recreational boaters to plan and execute trips on coastal and inland waterways. It is intended as the contract between product intent and implementation, and as the source of truth used by the architecture document ([`ARCHITECTURE.md`](./ARCHITECTURE.md)).

### 1.2 Scope
BoatBuddy is a Progressive Web App (PWA) built with Next.js and React. It is delivered through a browser on phones and tablets, with optional offline support. It is **not** intended to replace certified chartplotters or to be used as a primary navigation instrument for commercial vessels; it is a planning and situational-awareness tool for recreational use.

In scope:
- Trip planning and live trip execution for small recreational vessels.
- Display of public NOAA marine data (charts, tides, buoy observations, aids to navigation).
- A per-user library of boats with specifications, used to compute adaptive ETAs.
- Marina/harbor directory with amenities.

Out of scope (this version):
- Two-way AIS transmission or any safety-critical/SOLAS function.
- Multi-user fleet management.
- Social/sharing features.
- Native iOS/Android binaries (PWA only).
- Inclement weather forecasting and route-level weather advisory integration *(stretch goal — see §3.7)*.

### 1.3 Definitions, Acronyms
| Term | Meaning |
|---|---|
| **CO-OPS** | NOAA Center for Operational Oceanographic Products and Services (tides, water levels). |
| **NDBC** | National Data Buoy Center (wave heights, periods, wind). |
| **ENC** | Electronic Navigational Chart (NOAA vector chart product). |
| **AToN** | Aids to Navigation (buoys, daymarks, lights). |
| **ETA** | Estimated Time of Arrival. |
| **BFF** | Backend-for-Frontend (server layer tailored to UI needs). |
| **PWA** | Progressive Web App. |
| **MoSCoW** | Prioritization: Must / Should / Could / Won't. |

### 1.4 References
- NOAA CO-OPS API: https://api.tidesandcurrents.noaa.gov
- NOAA NDBC data services: https://www.ndbc.noaa.gov
- NOAA ENC chart catalog: https://nauticalcharts.noaa.gov
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js
- BoatBuddy Architecture Document: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 2. Overall Description

### 2.1 Product Perspective
BoatBuddy is a self-contained web product. It depends on three external services: Mapbox (base tiles + GL renderer), NOAA public data APIs (free, unauthenticated, but rate-aware), and an optional first-party PostgreSQL database for users who want cross-device sync of their boat profiles. The app is designed to degrade gracefully when offline or when NOAA endpoints are slow.

### 2.2 User Classes
1. **Recreational boater (primary):** Owns or charters a small powerboat or sailboat. Tech-comfortable but not a developer. Uses a phone or tablet on board.
2. **Trip planner (same person, different context):** Plans a trip from home the night before. Wants saved routes and forecast data.
3. **Anonymous visitor:** Browses the map without an account. Has limited features (no saved boats, no synced trips).

### 2.3 Operating Environment
- **Client:** Mobile Safari (iOS 16+), Chrome on Android 12+, recent desktop browsers for planning sessions.
- **Network:** Often intermittent (cellular dropouts on the water). Must tolerate ~5 s latency or full disconnection.
- **Hardware:** Phones with GPS, gyroscope, and ≥3 GB RAM. Touch primary; mouse/keyboard supported.

### 2.4 Design and Implementation Constraints
- Web stack only (React + Next.js, per project mandate).
- No paid third-party APIs in M1–M7; Mapbox free tier and NOAA public endpoints only.
- Bundle size budget: initial JS ≤ 250 KB gzipped on map route.
- Time to interactive on map route ≤ 2 s on a 2020-era mid-tier Android over 4G.

### 2.5 Assumptions
- Users grant browser geolocation permission.
- NOAA data is "good enough" for recreational situational awareness (it is the same data commercial marine apps use).
- Mapbox free tier (50k map loads/month) is sufficient for portfolio-scale traffic.

---

## 3. Functional Requirements

Requirements use the format `FR-NNN`. Each requirement has a MoSCoW priority. All "Must" requirements are in scope for the v1 release.

### 3.1 Map and Navigation

**FR-001 — Render marine basemap** *(Must)*
The system shall display a Mapbox-rendered vector map covering the user's geographic area, with marine-styled cartography (water foreground, land muted).

**FR-002 — Show user position** *(Must)*
The system shall request the browser's geolocation and display the user's current position as a vessel marker with heading indicator. Accuracy circle shall be drawn when GPS accuracy is worse than 25 m.

**FR-003 — Course-up / north-up toggle** *(Should)*
The user shall be able to rotate the map to match their heading ("course-up") or fix it to north ("north-up").

**FR-004 — Pan, zoom, tilt** *(Must)*
Standard map gestures (pinch zoom, two-finger rotate, two-finger drag for tilt) shall be supported.

**FR-005 — Search by place** *(Must)*
The user shall be able to search for harbors, marinas, towns, and water bodies; selecting a result centers the map and shows a detail card.

**FR-006 — Drop waypoint** *(Should)*
Long-press on the map shall drop a waypoint with lat/lon, distance from current position, and a "Route here" action.

**FR-007 — Route to destination** *(Must)*
Given a destination, the system shall draw a great-circle route line, display total distance, and update an ETA (see FR-020).

**FR-008 — Display aids to navigation** *(Must)*
The system shall overlay NOAA ENC aids to navigation (buoys, daymarks, lights) as an optional layer with appropriate IALA Region B symbology and color.

**FR-009 — Display hazards and restricted areas** *(Must)*
The system shall overlay obstructions, restricted areas, and no-wake zones from NOAA ENC, with tappable detail.

### 3.2 Water and Weather Data

**FR-010 — Water level / tide stations** *(Must)*
The system shall display NOAA CO-OPS tide stations within the visible map bounds, showing the latest observed water level relative to MLLW and the next high/low prediction. Data shall be refreshed at least once per 24 hours and on user pull-to-refresh.

**FR-011 — Charted depth overlay** *(Should)*
The system shall display charted soundings from NOAA ENC. Soundings shall be color-binned by the user's boat draft (see FR-023): unsafe (< draft + 1 ft), caution (< draft + 3 ft), safe (≥ draft + 3 ft).

**FR-012 — Wave observations** *(Must)*
The system shall display NDBC buoys within bounds, showing significant wave height, dominant period, and wind. Tapping a buoy opens a detail card with the latest hourly observation.

**FR-013 — Nearest-buoy lookup** *(Should)*
On long-press of any water location, the system shall identify and display the nearest reporting NDBC buoy and its current conditions.

### 3.3 Boat Profile

**FR-020 — Adaptive ETA** *(Must)*
The system shall continuously compute ETA from: (a) live GPS speed-over-ground when underway, (b) the active boat's cruise speed when stationary or planning, and (c) remaining great-circle distance. ETA shall update at least every 5 s while underway.

**FR-021 — Multiple boat profiles** *(Must)*
The user shall be able to maintain one or more boat profiles. One profile is marked "active" at any time.

**FR-022 — Boat seed database** *(Must)*
The system shall ship with a curated JSON database of common recreational boat models (initial target: ≥ 50 models across Sea Ray, Boston Whaler, Yamaha, Grady-White, Bayliner, Beneteau, Catalina, and others). Selecting a model pre-fills specs.

**FR-023 — Editable specs** *(Must)*
For each boat the user shall be able to enter or edit: length overall (LOA), beam, draft, displacement, engine type/power, cruise speed, max speed, fuel capacity, fuel burn at cruise (gph), fuel type.

**FR-024 — Custom boat** *(Must)*
The user shall be able to create a fully custom boat profile without selecting from the seed database.

**FR-025 — Fuel range estimate** *(Should)*
Given current fuel level (user-entered) and cruise burn rate, the system shall display estimated range and an on-map fuel-range ring.

### 3.4 Marinas and Harbors

**FR-030 — Marina layer** *(Must)*
The system shall display a toggleable layer of marinas and harbors within the visible bounds.

**FR-031 — Marina detail** *(Must)*
Tapping a marina shall open a detail card with: name, location, contact info, fuel availability (gas/diesel), slip availability indicator, pumpout, restrooms, food/restaurant on-site, marine store.

**FR-032 — Marina data source** *(Should)*
Marina data shall be sourced from a community/OpenStreetMap-derived dataset in v1; a curated provider may be added later.

### 3.5 User & Persistence

**FR-040 — Local persistence** *(Must)*
All user-created data (boat profiles, recent destinations, layer preferences) shall persist locally in IndexedDB and survive page reload.

**FR-041 — Optional account & sync** *(Could)*
The user may optionally sign in (email + magic link) to sync their boat library across devices.

**FR-042 — Offline tile caching** *(Should)*
The user shall be able to cache a tile bounding box for offline use covering up to 100 mi² per cache.

### 3.6 General UX

**FR-050 — Side menu profile** *(Must)*
A left-edge slide-in side menu shall expose: active boat selector, boat library, preferences (units, layers), about. Triggered by a hamburger icon top-left, matching the Google Maps mental model.

**FR-051 — Unit toggle** *(Must)*
The user shall be able to choose units: distance (nm / mi / km), speed (kn / mph / km/h), depth (ft / m), temperature (°F / °C). Default: imperial + nautical.

**FR-052 — Search bar** *(Must)*
A top search bar shall be persistently visible on the map view, matching Google Maps placement.

**FR-053 — Layer toggle button** *(Must)*
A floating action button shall toggle visibility of optional layers (tides, waves, AToN, hazards, marinas, depth).

### 3.7 Inclement Weather Awareness *(Stretch Goal — Post-v1)*

This section captures future requirements for integrating marine weather forecasting into trip planning and routing. All requirements in this section are priority **Could** and are explicitly out of scope for v1. They are documented here to inform architecture decisions and avoid painting the system into a corner.

**FR-060 — Marine zone forecast overlay** *(Could)*
The system shall display NOAA NWS marine zone forecasts as an optional map overlay. Zones with an active small-craft advisory, gale warning, or storm warning shall be rendered with a distinct color and icon. Data source: NWS Marine Zone Forecast API (`https://api.weather.gov/zones/offshore`).

**FR-061 — Route weather intersection check** *(Could)*
When the user sets a destination and a route is drawn, the system shall automatically check whether the route passes through any active NWS marine warning zone. If so, a non-blocking banner shall warn the user of the advisory type and affected segment.

**FR-062 — Forecast wind and gust overlay** *(Could)*
The system shall display a wind barb or arrow overlay sourced from NOAA GFS/NAM marine grids, showing forecast wind speed and direction for the next 6–24 hours at a user-selectable forecast hour. Gusts shall be indicated where available.

**FR-063 — Departure window suggestion** *(Could)*
Given a planned route and destination, the system shall analyze the forecast for the route corridor over the next 24 hours and surface up to three departure-time windows where forecast wind/wave conditions are below a user-configured comfort threshold (e.g., "winds < 15 kn, seas < 3 ft"). The suggestion UI shall make clear this is informational and not a safety guarantee.

**FR-064 — Weather alert push notification** *(Could)*
If the user has an active trip and a new NWS marine warning is issued for a zone intersecting their planned route, the system shall send a browser push notification (requires user opt-in). Notification shall include advisory type, zone name, and a deep link back to the map.

**FR-065 — Integrated weather detail card** *(Could)*
Tapping any point on the map while the forecast overlay is active shall open a detail card showing: current NDBC observations from the nearest buoy (carried over from FR-012), NWS hourly forecast for that grid point (wind, gusts, wave height where available), and active advisories for the containing marine zone.

**Data sources for §3.7:**
- NWS Marine API: `https://api.weather.gov` (zone forecasts, active alerts — no auth required).
- NOAA NDBC: already in scope (FR-012); reused for current conditions context.
- NOAA GFS/NAM grids: available via NWS gridded forecast endpoints; evaluate bandwidth cost before implementing FR-062.

**Open questions for §3.7:**
- Forecast grid data can be large; determine whether to pull only along the route polyline or cache a bounding box, and establish a cache TTL (suggest 1 h).
- Departure-window algorithm (FR-063) needs a defined "comfort threshold" UX — consider letting each boat profile store a preferred wind/wave limit.
- Push notifications (FR-064) require a service worker upgrade and VAPID key management; assess against v1 service worker work in FR-042.

---

## 4. Non-Functional Requirements

### 4.1 Performance
**NFR-001 — Time to Interactive:** ≤ 2 s on a 2020-era mid-tier Android over 4G (Lighthouse mobile profile).
**NFR-002 — Map pan/zoom:** sustained ≥ 55 fps on the target device.
**NFR-003 — Search response:** ≤ 300 ms p95 for autocomplete results.
**NFR-004 — Data freshness:** Tide and wave observations no more than 1 hour stale when online; explicit "stale" badge when older.
**NFR-005 — Bundle budget:** ≤ 250 KB gzipped initial JS on the map route.

### 4.2 Usability
**NFR-010 — Touch target size:** All interactive elements ≥ 44×44 pt (Apple HIG / WCAG 2.5.5).
**NFR-011 — Sunlight legibility:** Color palette tested in a high-brightness/high-contrast outdoor mode.
**NFR-012 — One-thumb operation:** Primary actions reachable in the bottom 60% of a 6.7" phone screen.
**NFR-013 — Accessibility:** WCAG 2.1 AA conformance for non-map UI; keyboard navigation supported.

### 4.3 Reliability
**NFR-020 — Graceful offline:** All previously fetched data shall remain viewable when offline. The vessel marker and ETA must continue to function from device GPS alone.
**NFR-021 — Error budget:** No more than 1% of API requests to the BFF may return 5xx over any rolling 7-day window.

### 4.4 Security & Privacy
**NFR-030 — No PII without consent:** Location data is processed client-side and is not transmitted to BoatBuddy servers unless the user opts in to trip sync.
**NFR-031 — Secret handling:** Mapbox tokens are scoped (URL-restricted) and read from server-side env vars; never embedded raw in the client bundle.
**NFR-032 — HTTPS only:** All endpoints, including local-dev where feasible.
**NFR-033 — Disclaimer:** A clear "not for primary navigation" disclaimer is shown on first launch and in the About page.

### 4.5 Maintainability
**NFR-040 — Type safety:** 100% TypeScript, `strict: true`.
**NFR-041 — Test coverage:** ≥ 70% line coverage on `lib/` (pure logic: ETA, geo, units).
**NFR-042 — Lint/format:** ESLint + Prettier enforced in CI.
**NFR-043 — Conventional commits:** Used for changelog generation.

### 4.6 Portability
**NFR-050 — Browser support:** Mobile Safari 16+, Chrome 110+ Android, Edge/Chrome/Firefox/Safari current-2 on desktop.
**NFR-051 — Responsive:** Single codebase serves phone, tablet, and desktop layouts.

---

## 5. External Interface Requirements

### 5.1 NOAA CO-OPS (Tides & Water Levels)
- Endpoint: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
- Auth: none.
- Rate: be a good citizen; cache 1 h per station.
- BFF responsibility: spatial query helper to map a bounding box to stations, then proxy data calls.

### 5.2 NOAA NDBC (Waves & Wind)
- Endpoint: text/JSON station feeds at `https://www.ndbc.noaa.gov/data/realtime2/{stationId}.txt`.
- Auth: none.
- Rate: cache 30 min per station.

### 5.3 NOAA ENC (Charts, AToN, Hazards)
- Source: NOAA ENC Direct or pre-converted vector tiles hosted on first-party CDN.
- v1 approach: pre-process ENC into vector-tile overlays at build time; serve as a Mapbox style layer.

### 5.4 Mapbox GL JS
- Base tiles + GL renderer.
- Token scoped to deployed origins.

### 5.5 Browser APIs
- `navigator.geolocation` (watchPosition).
- `DeviceOrientationEvent` for heading on devices without GPS-derived course.
- IndexedDB via `idb` library.
- Service Worker for offline.

---

## 6. User Stories (Selected)

**US-1 — Quick check before leaving the dock**
> *As a weekend boater, I want to open BoatBuddy on my phone and see current wave heights at the buoy outside the inlet, so I can decide whether to head out.*
> Maps to: FR-001, FR-002, FR-012.

**US-2 — Planning a 30-mile run**
> *As a boater planning a coastal hop, I want to set a destination and see how long it'll take in my Sea Ray 270 Sundancer at 22-knot cruise, so I can plan fuel and tide windows.*
> Maps to: FR-007, FR-020, FR-022, FR-025, FR-010.

**US-3 — Finding fuel underway**
> *As a boater with low fuel, I want to see nearby marinas with gas and an open slip for a fuel stop, so I can divert without guessing.*
> Maps to: FR-030, FR-031.

**US-4 — Avoiding shallows**
> *As a sailor with a 5'6" draft, I want shallow water shaded red on the chart so I can route around it.*
> Maps to: FR-011, FR-023.

**US-5 — Custom boat**
> *As an owner of an unusual boat not in the seed list, I want to enter my own specs once and have ETAs use them.*
> Maps to: FR-021, FR-023, FR-024.

**US-6 — Weather-aware trip planning** *(Stretch Goal)*
> *As a boater planning an offshore run for tomorrow morning, I want BoatBuddy to tell me if there are any active marine warnings along my route and suggest a departure time when winds and seas are within my comfort zone, so I can plan confidently and avoid getting caught out.*
> Maps to: FR-060, FR-061, FR-062, FR-063.

---

## 7. Acceptance Criteria (v1 Release Gate)

The product is releasable when:
- All `Must` FRs above pass manual acceptance on iOS Safari and Android Chrome.
- NFR-001 through NFR-005 are demonstrated in a Lighthouse run.
- The disclaimer in NFR-033 is shown on first launch.
- README, SRS, and ARCHITECTURE are current.
- E2E smoke test (Playwright) covers: load map → see position → pick boat → set destination → see ETA → toggle a layer.

---

## 8. Open Questions

1. **Marina data licensing:** OpenStreetMap is ODbL — confirm attribution requirements on detail cards.
2. **ENC vector tile hosting cost:** estimate CDN bandwidth at 10k MAU to validate Vercel free tier sufficiency.
3. **Compass heading on non-iOS:** Android browsers expose `DeviceOrientationEvent` inconsistently; fallback strategy needed.
4. **Sync data model:** if account sync (FR-041) is built, do we sync trips and routes or only boat library? Suggest library-only for v1 to limit scope.
