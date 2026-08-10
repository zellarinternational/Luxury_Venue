/**
 * One-time migration seed. Reads the JSON snapshots in server/db/seed/data/
 * (extracted once from the OLD repo's src/config/{venues,locations,events}.ts
 * via a throwaway script — this repo has no runtime dependency on the old
 * repo) and seeds:
 *   - the full country/city tree
 *   - the 2 real venues (infinity-ballroom, grand-hyatt-mumbai-ballroom) with
 *     complete floor-plan/table-area/stage/door-area/technical-markings graphs
 *   - event categories + event themes for the 2 real venues
 *   - the other 22 legacy venue slots as `status: 'coming_soon'` rows with no
 *     floor plan (see docs/ARCHITECTURE_PLAN.md §2.4 — do not re-seed the
 *     placeholder-clone geometry)
 *
 * Idempotent: safe to re-run against a fresh DB. Run via `npm run db:seed`.
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "../client";
import {
  countries as countriesTable,
  cities as citiesTable,
  venues as venuesTable,
  floorPlans as floorPlansTable,
  tableAreas as tableAreasTable,
  stages as stagesTable,
  doorAreas as doorAreasTable,
  eventCategories as eventCategoriesTable,
  eventThemes as eventThemesTable,
  technicalMarkings as technicalMarkingsTable,
} from "../schema";

const DATA_DIR = path.join(__dirname, "data");

function readJSON<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

interface LegacyCountry {
  id: string;
  name: string;
  tagline?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  order?: number;
  comingSoon?: boolean;
}

interface LegacyCity {
  id: string;
  countryId: string;
  name: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
}

interface Point2D {
  x: number;
  y: number;
}
interface Polygon4 {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

interface LegacyStage {
  id: string;
  name: string;
  fileName?: string;
  glbFileName?: string;
  x?: number;
  y?: number;
  rotation?: number;
  width?: number;
  height?: number; // legacy "height" = 2D depth of the stage footprint
  zOffset?: number;
  backstageDepth?: number;
  backstageSide?: string;
  position3D?: { x: number; y: number; z: number };
  stageObjects?: Record<string, unknown>[];
  [key: string]: unknown;
}

interface LegacyDoorArea extends Polygon4 {
  id: string;
  name: string;
  coordinates3D?: Record<string, unknown>;
}

interface LegacyTableArea {
  id: string;
  name: string;
  seatingMode?: "auto" | "tables-only" | "chairs-only";
  namedPoints?: Polygon4;
  maxCapacity?: number;
  [key: string]: unknown;
}

interface LegacyTechnicalMarkings {
  id: string;
  name?: string;
  enabled?: boolean;
  pathSegments?: Record<string, unknown>[];
  [key: string]: unknown;
}

interface LegacyFloorPlan {
  id: string;
  name: string;
  fileName?: string;
  glbFileName?: string;
  dxfUnits?: string;
  width?: number;
  height?: number;
  positionOffset3D?: { x: number; y: number; z: number };
  walkStartPosition?: { x: number; y: number; z: number; rotation: number };
  cornerPoints?: Polygon4;
  stages?: LegacyStage[];
  tableAreas?: LegacyTableArea[];
  doorAreas?: LegacyDoorArea[];
  technicalMarkings?: LegacyTechnicalMarkings;
  [key: string]: unknown;
}

interface LegacyVenue {
  id: string;
  venueId: string;
  venueName: string;
  name: string;
  description?: string;
  countryId: string;
  cityId: string;
  stateId?: string;
  stateName?: string;
  hotelImageUrl?: string;
  thumbnailImageUrl?: string;
  capacity?: {
    seated?: number;
    standing?: number;
    min?: number;
    max?: number;
  };
  googleMapsUrl?: string;
  defaultFloorPlanId?: string;
  floorPlans: LegacyFloorPlan[];
}

interface LegacyEventCategory {
  id: string;
  name: string;
  description?: string;
}

interface LegacyEventObject {
  [key: string]: unknown;
}

interface LegacyEventConfig {
  id: string;
  name: string;
  description?: string;
  objects: LegacyEventObject[];
}

const REAL_VENUE_IDS = ["infinity-ballroom", "grand-hyatt-mumbai-ballroom"];

async function seedLocations() {
  const { countries, cities } = readJSON<{
    countries: LegacyCountry[];
    cities: LegacyCity[];
  }>("locations.json");

  const countryIdMap = new Map<string, string>(); // legacy slug -> new uuid

  for (const c of countries) {
    const [row] = await db
      .insert(countriesTable)
      .values({
        slug: c.id,
        name: c.name,
        tagline: c.tagline,
        heroSubtitle: c.heroSubtitle,
        heroImageUrl: c.heroImageUrl,
        order: c.order ?? 0,
        comingSoon: c.comingSoon ? 1 : 0,
      })
      .returning({ id: countriesTable.id });
    countryIdMap.set(c.id, row.id);
  }

  const cityIdMap = new Map<string, string>(); // `${countryId}/${cityId}` -> new uuid

  for (const city of cities) {
    const countryUuid = countryIdMap.get(city.countryId);
    if (!countryUuid) {
      throw new Error(
        `City ${city.id} references unknown country ${city.countryId}`,
      );
    }
    const [row] = await db
      .insert(citiesTable)
      .values({
        countryId: countryUuid,
        slug: city.id,
        name: city.name,
        tagline: city.tagline,
        heroTitle: city.heroTitle,
        heroSubtitle: city.heroSubtitle,
        heroImageUrl: city.heroImageUrl,
      })
      .returning({ id: citiesTable.id });
    cityIdMap.set(`${city.countryId}/${city.id}`, row.id);
  }

  console.log(
    `Seeded ${countries.length} countries, ${cities.length} cities`,
  );
  return { countryIdMap, cityIdMap };
}

async function seedFloorPlanGraph(
  venueUuid: string,
  fp: LegacyFloorPlan,
): Promise<string> {
  const [fpRow] = await db
    .insert(floorPlansTable)
    .values({
      venueId: venueUuid,
      name: fp.name,
      dxfAssetUrl: fp.fileName,
      glbAssetUrl: fp.glbFileName,
      dxfUnits: fp.dxfUnits ?? "inches",
      widthUnits: fp.width,
      heightUnits: fp.height,
      bounds: fp.cornerPoints ?? null,
      positionOffset3D: fp.positionOffset3D ?? null,
      walkStartPosition: fp.walkStartPosition ?? null,
      raw: fp as unknown as Record<string, unknown>,
    })
    .returning({ id: floorPlansTable.id });

  for (const ta of fp.tableAreas ?? []) {
    await db.insert(tableAreasTable).values({
      floorPlanId: fpRow.id,
      name: ta.name,
      seatingMode: ta.seatingMode ?? "auto",
      polygon: ta.namedPoints ?? null,
      tableConfig: ta as unknown as Record<string, unknown>,
      maxCapacity: ta.maxCapacity,
    });
  }

  for (const stage of fp.stages ?? []) {
    await db.insert(stagesTable).values({
      floorPlanId: fpRow.id,
      name: stage.name,
      dxfAssetUrl: stage.fileName,
      glbAssetUrl: stage.glbFileName,
      x: stage.x,
      y: stage.y,
      rotation: stage.rotation ?? 0,
      width: stage.width,
      depth: stage.height, // legacy "height" field is the 2D footprint depth
      zOffset: stage.zOffset,
      backstageDepth: stage.backstageDepth,
      backstageSide: stage.backstageSide,
      position3D: stage.position3D ?? null,
      stageObjects: stage.stageObjects ?? null,
      raw: stage as unknown as Record<string, unknown>,
    });
  }

  for (const door of fp.doorAreas ?? []) {
    await db.insert(doorAreasTable).values({
      floorPlanId: fpRow.id,
      name: door.name,
      polygon: {
        topLeft: door.topLeft,
        topRight: door.topRight,
        bottomRight: door.bottomRight,
        bottomLeft: door.bottomLeft,
      },
      coordinates3D: door.coordinates3D ?? null,
    });
  }

  if (fp.technicalMarkings) {
    await db.insert(technicalMarkingsTable).values({
      floorPlanId: fpRow.id,
      kind: fp.technicalMarkings.id,
      pathSegments: fp.technicalMarkings.pathSegments ?? null,
      enabled: fp.technicalMarkings.enabled === false ? 0 : 1,
    });
  }

  return fpRow.id;
}

async function seedVenues(
  countryIdMap: Map<string, string>,
  cityIdMap: Map<string, string>,
) {
  const realVenues = readJSON<LegacyVenue[]>("venues-real.json");
  const placeholderVenues = readJSON<
    Array<{
      id: string;
      venueId: string;
      venueName: string;
      name: string;
      description?: string;
      countryId: string;
      cityId: string;
      hotelImageUrl?: string;
      thumbnailImageUrl?: string;
      capacity?: {
        seated?: number;
        standing?: number;
        min?: number;
        max?: number;
      };
      googleMapsUrl?: string;
    }>
  >("venues-placeholder.json");

  function resolveCityUuid(countryId: string, cityId: string): string {
    const uuid = cityIdMap.get(`${countryId}/${cityId}`);
    if (!uuid) {
      throw new Error(`Venue references unknown city ${countryId}/${cityId}`);
    }
    return uuid;
  }

  for (const v of realVenues) {
    const cityUuid = resolveCityUuid(v.countryId, v.cityId);
    const [venueRow] = await db
      .insert(venuesTable)
      .values({
        cityId: cityUuid,
        slug: v.id,
        venueGroupId: v.venueId,
        venueGroupName: v.venueName,
        name: v.name,
        description: v.description,
        status: "live",
        stateId: v.stateId,
        stateName: v.stateName,
        hotelImageUrl: v.hotelImageUrl,
        thumbnailImageUrl: v.thumbnailImageUrl,
        capacitySeated: v.capacity?.seated,
        capacityStanding: v.capacity?.standing,
        capacityMin: v.capacity?.min,
        capacityMax: v.capacity?.max,
        googleMapsUrl: v.googleMapsUrl,
      })
      .returning({ id: venuesTable.id });

    let defaultFloorPlanUuid: string | null = null;
    for (const fp of v.floorPlans) {
      const fpUuid = await seedFloorPlanGraph(venueRow.id, fp);
      if (fp.id === v.defaultFloorPlanId) defaultFloorPlanUuid = fpUuid;
    }
    if (defaultFloorPlanUuid) {
      await db
        .update(venuesTable)
        .set({ defaultFloorPlanId: defaultFloorPlanUuid })
        .where(eq(venuesTable.id, venueRow.id));
    }
  }

  for (const v of placeholderVenues) {
    const cityUuid = resolveCityUuid(v.countryId, v.cityId);
    await db.insert(venuesTable).values({
      cityId: cityUuid,
      slug: v.id,
      venueGroupId: v.venueId,
      venueGroupName: v.venueName,
      name: v.name,
      description: v.description,
      status: "coming_soon",
      hotelImageUrl: v.hotelImageUrl,
      thumbnailImageUrl: v.thumbnailImageUrl,
      capacitySeated: v.capacity?.seated,
      capacityStanding: v.capacity?.standing,
      capacityMin: v.capacity?.min,
      capacityMax: v.capacity?.max,
      googleMapsUrl: v.googleMapsUrl,
    });
  }

  console.log(
    `Seeded ${realVenues.length} live venues (full floor-plan graphs), ${placeholderVenues.length} coming-soon venues`,
  );

  return { realVenueSlugToUuid: await getVenueSlugMap(REAL_VENUE_IDS) };
}

async function getVenueSlugMap(slugs: string[]) {
  const rows = await db.select().from(venuesTable);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (slugs.includes(row.slug)) map.set(row.slug, row.id);
  }
  return map;
}

async function seedEvents(realVenueSlugToUuid: Map<string, string>) {
  const { eventCategories, venueEvents } = readJSON<{
    eventCategories: LegacyEventCategory[];
    venueEvents: Record<string, LegacyEventConfig[]>;
  }>("events.json");

  const categoryIdMap = new Map<string, string>();
  for (const cat of eventCategories) {
    const [row] = await db
      .insert(eventCategoriesTable)
      .values({ slug: cat.id, name: cat.name, description: cat.description })
      .returning({ id: eventCategoriesTable.id });
    categoryIdMap.set(cat.id, row.id);
  }

  let themeCount = 0;
  for (const [venueSlug, themes] of Object.entries(venueEvents)) {
    const venueUuid = realVenueSlugToUuid.get(venueSlug);
    if (!venueUuid) continue;
    for (const theme of themes) {
      await db.insert(eventThemesTable).values({
        venueId: venueUuid,
        name: theme.name,
        description: theme.description,
        objects: theme.objects as unknown as Record<string, unknown>[],
      });
      themeCount++;
    }
  }

  console.log(
    `Seeded ${eventCategories.length} event categories, ${themeCount} event themes`,
  );
}

async function main() {
  console.log("Seeding from legacy config snapshot...");
  const { countryIdMap, cityIdMap } = await seedLocations();
  const { realVenueSlugToUuid } = await seedVenues(countryIdMap, cityIdMap);
  await seedEvents(realVenueSlugToUuid);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
