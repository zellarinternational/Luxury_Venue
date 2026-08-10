import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const venueStatus = pgEnum("venue_status", ["live", "coming_soon"]);
export const seatingMode = pgEnum("seating_mode", [
  "auto",
  "tables-only",
  "chairs-only",
]);

export const countries = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  heroImageUrl: text("hero_image_url"),
  order: integer("order").default(0),
  comingSoon: integer("coming_soon").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cities = pgTable("cities", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryId: uuid("country_id")
    .notNull()
    .references(() => countries.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  heroImageUrl: text("hero_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  cityId: uuid("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  venueGroupId: text("venue_group_id").notNull(), // groups multiple hallrooms under one hotel
  venueGroupName: text("venue_group_name").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: venueStatus("status").notNull().default("coming_soon"),
  hotelImageUrl: text("hotel_image_url"),
  thumbnailImageUrl: text("thumbnail_image_url"),
  capacitySeated: integer("capacity_seated"),
  capacityStanding: integer("capacity_standing"),
  capacityMin: integer("capacity_min"),
  capacityMax: integer("capacity_max"),
  googleMapsUrl: text("google_maps_url"),
  defaultFloorPlanId: uuid("default_floor_plan_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const floorPlans = pgTable("floor_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dxfAssetUrl: text("dxf_asset_url"),
  glbAssetUrl: text("glb_asset_url"),
  dxfUnits: text("dxf_units").default("inches"),
  widthUnits: integer("width_units"),
  heightUnits: integer("height_units"),
  scaleFactor: integer("scale_factor"), // world-units-per-DXF-unit for 3D placement; fixes the old 47.5-hardcode drift bug
  bounds: jsonb("bounds").$type<{
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  } | null>(),
  positionOffset3D: jsonb("position_offset_3d").$type<{
    x: number;
    y: number;
    z: number;
  } | null>(),
  walkStartPosition: jsonb("walk_start_position").$type<{
    x: number;
    y: number;
    z: number;
    rotation: number;
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tableAreas = pgTable("table_areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  seatingMode: seatingMode("seating_mode").notNull().default("auto"),
  polygon: jsonb("polygon").$type<{
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  }>(),
  tableConfig: jsonb("table_config").$type<Record<string, unknown>>(), // width/height/chairsPerTable/spacing/singleChair/etc — kept jsonb to match tableCalculator's existing shape
  maxCapacity: integer("max_capacity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dxfAssetUrl: text("dxf_asset_url"),
  glbAssetUrl: text("glb_asset_url"),
  x: integer("x"),
  y: integer("y"),
  rotation: integer("rotation").default(0),
  width: integer("width"),
  depth: integer("depth"),
  backstageDepth: integer("backstage_depth"),
  backstageSide: text("backstage_side"),
  position3D: jsonb("position_3d").$type<{
    x: number;
    y: number;
    z: number;
  } | null>(),
  stageObjects: jsonb("stage_objects").$type<Record<string, unknown>[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const doorAreas = pgTable("door_areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").default("entrance"), // entrance | exit | emergency | service
  polygon: jsonb("polygon").$type<{
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  }>(),
  coordinates3D: jsonb("coordinates_3d").$type<Record<string, unknown> | null>(),
  clearance: integer("clearance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventCategories = pgTable("event_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const eventThemes = pgTable("event_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").references(() => venues.id, {
    onDelete: "cascade",
  }),
  categoryId: uuid("category_id").references(() => eventCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  objects: jsonb("objects").$type<Record<string, unknown>[]>(), // decor object placements — kept jsonb, matches EventObjectConfig[] shape
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const technicalMarkings = pgTable("technical_markings", {
  id: uuid("id").primaryKey().defaultRandom(),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  pathSegments: jsonb("path_segments").$type<Record<string, unknown>[]>(),
  enabled: integer("enabled").default(1),
});

export const sharedConfigs = pgTable("shared_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  shortCode: text("short_code").notNull().unique(), // the public-facing /share/[id] slug
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id),
  floorPlanId: uuid("floor_plan_id")
    .notNull()
    .references(() => floorPlans.id),
  placedObjects: jsonb("placed_objects").$type<Record<string, unknown>[]>(),
  guestCount: integer("guest_count").default(0),
  seatingMode: seatingMode("seating_mode").default("auto"),
  selectedStageId: uuid("selected_stage_id"),
  selectedEventThemeId: uuid("selected_event_theme_id"),
  manualTableCount: integer("manual_table_count"),
  manualChairCount: integer("manual_chair_count"),
  version: integer("version").notNull().default(1), // optimistic concurrency: UPDATE ... WHERE version = $current
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- relations (for Drizzle's relational query API) ---

export const countriesRelations = relations(countries, ({ many }) => ({
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one, many }) => ({
  country: one(countries, {
    fields: [cities.countryId],
    references: [countries.id],
  }),
  venues: many(venues),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  city: one(cities, { fields: [venues.cityId], references: [cities.id] }),
  floorPlans: many(floorPlans),
  eventThemes: many(eventThemes),
}));

export const floorPlansRelations = relations(floorPlans, ({ one, many }) => ({
  venue: one(venues, {
    fields: [floorPlans.venueId],
    references: [venues.id],
  }),
  tableAreas: many(tableAreas),
  stages: many(stages),
  doorAreas: many(doorAreas),
  technicalMarkings: many(technicalMarkings),
}));

export const tableAreasRelations = relations(tableAreas, ({ one }) => ({
  floorPlan: one(floorPlans, {
    fields: [tableAreas.floorPlanId],
    references: [floorPlans.id],
  }),
}));

export const stagesRelations = relations(stages, ({ one }) => ({
  floorPlan: one(floorPlans, {
    fields: [stages.floorPlanId],
    references: [floorPlans.id],
  }),
}));

export const doorAreasRelations = relations(doorAreas, ({ one }) => ({
  floorPlan: one(floorPlans, {
    fields: [doorAreas.floorPlanId],
    references: [floorPlans.id],
  }),
}));

export const eventThemesRelations = relations(eventThemes, ({ one }) => ({
  venue: one(venues, {
    fields: [eventThemes.venueId],
    references: [venues.id],
  }),
  category: one(eventCategories, {
    fields: [eventThemes.categoryId],
    references: [eventCategories.id],
  }),
}));

export const sharedConfigsRelations = relations(sharedConfigs, ({ one }) => ({
  venue: one(venues, {
    fields: [sharedConfigs.venueId],
    references: [venues.id],
  }),
  floorPlan: one(floorPlans, {
    fields: [sharedConfigs.floorPlanId],
    references: [floorPlans.id],
  }),
}));
