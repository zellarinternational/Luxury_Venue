/**
 * One-time migration: reads the OLD repo's src/config/{venues,locations,events}.ts
 * (read-only reference, not a dependency of this project) and seeds:
 *   - the full country/city tree
 *   - the 2 real venues (infinity-ballroom, grand-hyatt-mumbai-ballroom) with
 *     complete floor-plan/table-area/stage/door-area graphs
 *   - event themes/categories in full
 * All other legacy venue slots become `status: 'coming_soon'` rows with no
 * floor plan (see plan §2.4 — do not re-seed the 22 placeholder clones).
 *
 * Not yet implemented — this is Phase 2 work. Run via `npm run db:seed`.
 */

async function main() {
  throw new Error(
    "migrate-from-legacy.ts is a Phase 2 placeholder. See docs/plan for the seeding strategy.",
  );
}

main();
