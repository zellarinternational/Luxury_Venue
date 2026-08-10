# Event Venue Studio — Ground-Up Rewrite Plan

## Context

The current app (`/Users/utkarshsingh/Desktop/Luxury_Venue_Setup`, Next.js 15 / React 19 / Three.js+R3F / Zustand) grew fast and it shows: all venue/location/event data is hardcoded in a single 3575-line `src/config/venues.ts` with no backend; the seating-placement algorithm, DXF rendering, and GLB memory management each exist in 2-3 competing, partially-diverged implementations (only one of which is actually live in each case); the "share link" realtime feature is named for WebSockets but is actually SSE-over-polling backed by a flat JSON file with no locking; and 22 of the 24 listed venues are placeholder clones of one real ballroom's geometry. The frontend is a single hardcoded dark/gold theme (~8 CSS classes plus scattered inline hex) with no real design tokens, weak accessibility, and duplicated/dead marketing components.

The goal is a from-scratch rewrite: a new repo, a real database-backed content model, a proper custom design system in the register of Apple/Anthropic/Salesforce, and a cleaned-up hall planner that keeps the DXF-CAD pipeline for now but is architected so it can be swapped for a native in-app editor later without touching placement or rendering logic. This plan sequences that work so a real, on-brand, DB-backed marketing site ships before the much riskier 3D planner port is complete.

**Confirmed decisions:** new repo (old repo stays untouched as a read-only porting reference); Postgres + Drizzle + tRPC; Vercel (app) + Neon (Postgres) + Cloudflare R2 (GLB/DXF asset storage); custom design system on Radix + Tailwind v4 (not shadcn); keep the DXF pipeline but isolate it behind an abstraction; seed only the 2 real venues (`infinity-ballroom`, `grand-hyatt-mumbai-ballroom`) and mark the other 22 city/venue listings as "coming soon" rather than re-faking clones.

---

## 1. Repo structure

Single Next.js app (not a monorepo — no second deployable exists yet to justify one), but with hard internal module boundaries enforced by lint rules (`eslint-plugin-boundaries` or `dependency-cruiser`) so it can be split into packages later without a rewrite.

```
apps/web/
  app/                     # routes: /, /country/[id], /country/[id]/[cityId], /.../hotel/[venueId], /hall, /share/[id]
  src/
    modules/
      catalog/             # venue/location browsing — replaces components/HotelCard.tsx, EventVenueCard.tsx, current app/country/* pages
      hall-planner/
        geometry-source/   # THE abstraction boundary — see §4.3
          dxf/             # current DXF-backed implementation (ports advancedDxfRenderer.tsx)
          types.ts         # FloorPlanGeometrySource interface; nothing outside this folder may import dxf-viewer/dxf-parser
        placement/         # merged/rewritten tableCalculator.ts — pure, dependency-free, unit-testable
        scene/             # R3F canvases — replaces HallCanvas3DGlobal.tsx / HallCanvas3DWalk.tsx
        gl-resources/      # unifies memoryManager/modelManager/optimizedGlbLoader/sharedModelResources
      sharing/             # share-link + realtime — replaces websocketManager.ts/websocketStore.ts/app/api/ws
    design-system/         # tokens + Radix-wrapped components
    lib/                   # tRPC client, zod schemas, generic utils
  public/                  # marketing hero images ONLY — no GLB/DXF
server/
  db/
    schema.ts              # Drizzle schema
    migrations/
    seed/                  # migrate-from-legacy.ts (reads old venues.ts/locations.ts/events.ts read-only)
  api/                     # tRPC routers
```

**Hard rule enforced by CI:** placement/, scene/, and the store may only import the `FloorPlanGeometry` type from `geometry-source/types.ts` — never dxf-viewer, dxf-parser, or a raw DXF path. This is the concrete mechanism that makes a future native-editor swap a new `geometry-source/native/` implementation instead of a rewrite.

---

## 2. Backend & data model

**Stack:** Postgres (Neon) + Drizzle ORM + tRPC + zod (shared validation) + `@tanstack/react-query` (via tRPC). Drizzle over Prisma because migrations stay plain, reviewable SQL during a fast-evolving schema; tRPC over REST/GraphQL because this is a single Next.js app end-to-end with no external API consumers today — it replaces "import a typed config const" with "call a typed procedure" at minimal cost. Revisit only if a non-Next.js client (native app, partner integration) shows up later.

**Schema** (mirrors the current conceptual hierarchy in `venues.ts` 1:1 so migration is mechanical):

```
countries, cities                          -- from locations.ts
venues            (city_id FK, status: 'live' | 'coming_soon', ...)
floor_plans       (venue_id FK, dxf_asset_url, glb_asset_url, scale_factor, bounds jsonb)
table_areas       (floor_plan_id FK, polygon jsonb, seating_mode, capacity fields)
stages            (floor_plan_id FK, polygon jsonb, glb_asset_url, rotation, backstage fields)
door_areas        (floor_plan_id FK, polygon jsonb)
event_categories, event_themes             -- from eventCategories.ts / events.ts
technical_markings (floor_plan_id FK, kind, polygon jsonb)
shared_configs    (venue_id FK, floor_plan_id FK, placed_objects jsonb, guest_count,
                   seating_mode, version int, expires_at, updated_at)
```

Keep `polygon`/`placed_objects` as `jsonb` rather than fully normalizing into point tables — matches what `tableCalculator.ts` and the hall store already consume, minimizing churn when switching from static import to API fetch. `shared_configs.version` + `updated_at` enable optimistic concurrency (compare-and-swap on update), fixing the current no-locking full-file-rewrite race in `data/shared-configs.json`.

Asset columns store **Cloudflare R2 URLs**, not local paths.

**Migration/seeding:** a one-time `server/db/seed/migrate-from-legacy.ts` reads the old repo's `venues.ts`/`locations.ts`/`events.ts` (read-only import, old repo untouched) and seeds: (a) the full country/city tree, (b) the 2 real venues with complete floor-plan/table-area/stage/door-area graphs, (c) event themes/categories in full. The other 22 venue slots become `status: 'coming_soon'` rows with no floor plan — an honest product state, not a faked one. Validate with a script asserting row counts and byte-for-byte comparison of known geometry values (e.g. one table-area's polygon) between legacy config and new DB rows.

**Share/realtime redesign:** replace the mislabeled SSE-over-polling system (`app/api/ws`, `useWebSocket()`, `websocketManager.ts`/`websocketStore.ts`, flat-file storage) with the `shared_configs` table (optimistic concurrency instead of full-file rewrites — correct by construction on serverless/multi-instance) plus **Ably** or **Pusher** for the realtime push (Neon doesn't expose LISTEN/NOTIFY cleanly over pooled serverless connections, so Supabase Realtime isn't an option given the Neon choice). Name the hook `useSharedConfigSync()`, not `useWebSocket()` — transport-agnostic naming from day one so this doesn't recur.

---

## 3. Design system

**Tokens (Tailwind v4 CSS-first `@theme`):** replace the current single hardcoded dark/gold theme (`app/globals.css`'s `.luxury-gradient`/`.luxury-card`/`.accent-button` plus scattered raw hex arbitrary-value classes) with a real token set — OKLCH-based neutral + accent color ramps (supporting both a dark and a genuinely new light theme via `[data-theme]` overrides), a restrained two-family type scale, a 4-step radius/shadow system, and named motion tokens (`--ease-standard`, `--duration-fast/base/slow`). This is the single source of truth Tailwind utilities read from — no more inline hex.

**Radix primitives** (behavior-heavy components only; everything visual stays bespoke Tailwind): `Dialog` (share/guest-count modals), `DropdownMenu` (filters, replacing raw `<select>`s), `Tabs` (orbit/walk + seating-mode switches), `Tooltip`, `Slider` (guest count), `Toast`, `VisuallyHidden` + baked-in focus-visible styling (fixes today's bare `focus:outline-none` with no replacement and near-total lack of image alt text).

**Component inventory:**
- `EntityCard` (image/title/meta/badge/CTA primitive) + thin `VenueCard`/`EventCard` adapters — replaces `components/HotelCard.tsx` + `components/EventVenueCard.tsx`, which are ~70% duplicated markup today; this kills the duplication structurally instead of by discipline.
- Keep `components/Checkbox.tsx` near-verbatim (the one clean, reusable, prop-driven component today) — re-skin on new tokens only.
- Drop `components/HeroCarousel.tsx` entirely — confirmed dead code (JSX body and its only call site are both commented out). Rebuild fresh on `embla-carousel-react` (already a dependency) if a hero carousel is wanted.
- Keep the existing semantic breadcrumb/`nav` structure (genuinely decent today) — restyle only.
- New: `AppShell`/`NavBar` with a working light/dark toggle (doesn't exist today), `FilterBar`, `Button` (primary/secondary/ghost — max 3 variants), `Badge`, `Skeleton` (loading states didn't exist before since data was synchronous static config; now it's a network call).

---

## 4. 2D floor-plan / seating improvements (DXF pipeline retained)

**Consolidate 3 DXF pipelines → 1.** Today: `advancedDxfRenderer.tsx` (dxf-viewer-backed, the only one actually live), `dxfRenderer.tsx` (fully dead hand-rolled parser — do not port), `simpleDxfExtractor.ts`/`SimpleDxfOverlay.tsx` (a third minimal path used only for 2 event props with an undocumented magic-number scale hack). Port only `advancedDxfRenderer.tsx`'s approach; fold the 2 event-prop cases into it as an explicit parametrized case once the magic-number hack's actual purpose (almost certainly a scale/origin special-case) is identified during port.

**Fix the placement-algorithm duplication.** Live `src/utils/tableCalculator.ts` (`calculateTableArrangement` → `placeTablesOnly`/`placeChairsOnly`/`placeSmartMix`) does bounding-box-only polygon containment; a ~700-line dead reimplementation inside `venues.ts` (`calculateSmartSeating` etc., never imported elsewhere) does true polygon-corner containment. **Merge, don't pick one**: port `tableCalculator.ts`'s control flow, door-avoidance integration, and carpet/aisle logic as the base, but graft in the dead code's polygon-corner containment as the geometry primitive. Write this as a pure, framework-free `placement/geometry.ts` (point-in-polygon, corner-in-polygon) that's unit-testable without React or Three.

**Abstraction boundary** (`geometry-source/types.ts`):
```ts
interface FloorPlanGeometrySource {
  loadGeometry(floorPlanId: string): Promise<FloorPlanGeometry>; // polygons, scale, origin, layers
  getTableAreas(): TableAreaPolygon[];
  getDoorAreas(): DoorAreaPolygon[];
  getStagePlacement(): StagePolygon | null;
}
```
`placement/` and `scene/` depend only on `FloorPlanGeometry` — never on dxf-viewer types or raw DXF entities. A future native polygon editor becomes a second implementation of this interface with zero changes required elsewhere.

**UX additions:** real loading/empty states for floor-plan fetch (didn't exist with synchronous static config); dev-flag-gated visual debug overlays for door-avoidance/containment (extend the existing `featureFlags.ts` pattern) so future algorithm tuning doesn't require console-log archaeology; automated regression fixtures (see §7) built before the algorithm merge lands, so changes are provably non-regressive.

---

## 5. 3D rendering carryover

**Port as-is:** `src/components/InstancedGLBModel.tsx` (real, well-built GPU instancing — draw calls drop from ~1000 to ~5 for 200 tables) and `src/utils/sharedModelResources.ts` (real geometry/material/texture dedup across instances) — both become the foundation of `hall-planner/scene/` and `gl-resources/` respectively.

**Fix while porting:**
- **Coordinate transform**: today `x=(dxf_x-centerX)/scale, z=-(dxf_y-centerY)/scale` is reimplemented independently 5+ times across `HallCanvas3DGlobal.tsx`/`HallCanvas3DWalk.tsx`. Extract into one `scene/coordinateTransform.ts` (`dxfToWorld`/`worldToDxf`) with unit tests pinning known input/output pairs from both real venues' floor plans — every caller uses this and nothing else.
- **47.5 scale-factor drift bug**: Walk mode's `Tables3D` hardcodes `scaleFactor=47.5`, ignoring its own dynamically-computed value. Once `coordinateTransform.ts` is the sole place scale is applied, this bug class becomes structurally impossible. During port, determine whether 47.5 or the dynamic computation was actually correct for the 2 real venues, and encode the answer as a per-floor-plan `scale_factor` DB column (§2), not a code constant.
- **GLB memory/loading consolidation**: `memoryManager.ts`, `modelManager.ts`, and `optimizedGlbLoader.ts` currently overlap uncoordinated (the last is mostly dead code feeding an always-zero counter that's still read by the live monitor). Consolidate into `gl-resources/{loader.ts, resourcePool.ts, memoryMonitor.ts}` — one GLTFLoader + KTX2/Draco setup, the real dedup logic from `sharedModelResources.ts`, and a memory monitor driven by real queries (not the phantom counter).
- **Device-tier logic**: keep `deviceDetection.ts`'s `detect-gpu` usage, but centralize tier → config decisions (LOD, texture resolution, max concurrent loads) into one `getDeviceTier()` consumed by `gl-resources/`, rather than tier checks scattered through rendering code.

---

## 6. Asset migration

752MB in the old `public/` (51 GLBs ~680MB, 34 DXFs ~76MB) serves only `/hall`; marketing routes need only a handful of hero JPGs, which move to the new `apps/web/public/` directly. GLB/DXF assets move to **Cloudflare R2**, referenced by URL from `floor_plans`/`stages`/`event_themes`.

**Prerequisite, done in the old repo first (read-only):** triage the `-opt`/`_final`/plain-name GLB variants and `_old`/`#`-prefixed DXF variants against what `venues.ts`/`stages.ts`/`events.ts` actually reference today, producing a manifest of `legacy_path → canonical_asset_id → R2 key`. Only canonical files for the 2 real venues get uploaded (roughly 10-20% of the 752MB, consistent with the "coming-soon" decision in §2). Record a sha256 per uploaded asset in the DB so future duplicate accumulation is caught automatically.

---

## 7. Phased execution & verification

1. **Foundations** — repo scaffold, CI with the module-boundary lint rule, Neon+Drizzle+tRPC wiring with an empty schema, `@theme` token skeleton, Radix + component scaffold.
   *Verify:* CI fails a build that imports dxf-viewer outside `geometry-source/`; a `/design-system` route renders every token/component for visual sign-off.
2. **Data model + migration** — full schema, `migrate-from-legacy.ts`, asset triage manifest + R2 upload of the 2 real venues (runs in parallel with schema work).
   *Verify:* row-count assertions + byte-for-byte geometry diff (legacy config vs DB) for known values; manual review of the asset manifest before upload.
3. **Marketing/catalog frontend** — rebuild `/`, `/country/[id]`, `/country/[id]/[cityId]`, hotel pages on `EntityCard`/`VenueCard`, reading from tRPC. **This is the first shippable slice — ship before the hall planner port finishes**, validating backend + design system independently of the riskier 3D work.
   *Verify:* Playwright smoke tests over the full route tree; visual regression against tokens; Lighthouse accessibility gate.
4. **Hall planner port** — geometry-source abstraction + DXF implementation, merged placement algorithm, unified coordinate transform + GL-resource consolidation, scene components. Build/verify against the 2 real venues only.
   *Verify:* seating-algorithm parity fixtures (floor plan × guest count × mode → expected counts, no-overlap, no-door-collision) at multiple guest counts per real venue; coordinate-transform unit tests pinning exact world coordinates; headless 3D visual-regression screenshots for orbit/walk on both venues; manual QA of door-avoidance and non-phantom memory-monitor readings.
5. **Share/realtime redesign** — `shared_configs` table with optimistic concurrency + Ably/Pusher push.
   *Verify:* concurrent-write test asserting compare-and-swap rejects/retries correctly; multi-instance realtime delivery test (the thing the old SSE-over-polling design couldn't guarantee).
6. **Cutover** — DNS switch, old deployment decommissioned (repo kept as reference), monitoring live before switch, documented rollback.
   *Verify:* side-by-side parity smoke test (visual + guest-count scenarios) against the old app for both real venues before traffic switch.

Phases 3 and 4 can overlap in engineering time (clean API-layer boundary between them); Phase 4's completion gates Phase 5.

---

### Critical files being replaced/ported (old repo, reference only)
- `src/config/venues.ts`, `locations.ts`, `events.ts`, `eventCategories.ts`, `stages.ts`, `technicalMarkings.ts`, `shared.ts`
- `src/utils/tableCalculator.ts` (base for merged placement algorithm)
- `src/utils/advancedDxfRenderer.tsx` (base for geometry-source DXF implementation)
- `src/components/Canvas/HallCanvas3DGlobal.tsx`, `HallCanvas3DWalk.tsx`, `InstancedGLBModel.tsx`
- `src/utils/sharedModelResources.ts`, `memoryManager.ts`, `modelManager.ts`, `optimizedGlbLoader.ts`
- `src/store/hallStore.ts`
- `app/api/share/route.ts`, `app/api/share/[id]/route.ts`, `app/api/ws/route.ts`, `websocketManager.ts`, `websocketStore.ts`, `sharedConfigStorage.ts`
- `components/HotelCard.tsx`, `EventVenueCard.tsx`, `HeroCarousel.tsx`, `Checkbox.tsx`
- `app/globals.css`
