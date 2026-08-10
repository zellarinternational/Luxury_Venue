import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { venues, cities, countries, floorPlans } from "../../db/schema";

export const venuesRouter = router({
  listByCity: publicProcedure
    .input(z.object({ countrySlug: z.string(), citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: venues.id,
          slug: venues.slug,
          name: venues.name,
          venueGroupName: venues.venueGroupName,
          status: venues.status,
          thumbnailImageUrl: venues.thumbnailImageUrl,
          capacitySeated: venues.capacitySeated,
          capacityMax: venues.capacityMax,
        })
        .from(venues)
        .innerJoin(cities, eq(venues.cityId, cities.id))
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(
          and(
            eq(countries.slug, input.countrySlug),
            eq(cities.slug, input.citySlug),
          ),
        );
    }),

  /** Groups hallrooms by parent hotel (venueGroupId) for the city listing page. */
  listHotelsByCity: publicProcedure
    .input(z.object({ countrySlug: z.string(), citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          venueGroupId: venues.venueGroupId,
          venueGroupName: venues.venueGroupName,
          status: venues.status,
          hotelImageUrl: venues.hotelImageUrl,
          thumbnailImageUrl: venues.thumbnailImageUrl,
          capacitySeated: venues.capacitySeated,
          capacityMax: venues.capacityMax,
        })
        .from(venues)
        .innerJoin(cities, eq(venues.cityId, cities.id))
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(
          and(
            eq(countries.slug, input.countrySlug),
            eq(cities.slug, input.citySlug),
          ),
        );

      const hotels = new Map<
        string,
        {
          venueGroupId: string;
          venueGroupName: string;
          imageUrl: string | null;
          hallroomCount: number;
          hasLiveHallroom: boolean;
          capacityMax: number;
        }
      >();

      for (const row of rows) {
        const existing = hotels.get(row.venueGroupId);
        if (existing) {
          existing.hallroomCount += 1;
          existing.hasLiveHallroom ||= row.status === "live";
          existing.capacityMax = Math.max(
            existing.capacityMax,
            row.capacityMax ?? 0,
          );
        } else {
          hotels.set(row.venueGroupId, {
            venueGroupId: row.venueGroupId,
            venueGroupName: row.venueGroupName,
            imageUrl: row.hotelImageUrl ?? row.thumbnailImageUrl,
            hallroomCount: 1,
            hasLiveHallroom: row.status === "live",
            capacityMax: row.capacityMax ?? 0,
          });
        }
      }

      return Array.from(hotels.values());
    }),

  /** Hallrooms belonging to one hotel, for the hotel detail page. */
  listByHotelGroup: publicProcedure
    .input(
      z.object({
        countrySlug: z.string(),
        citySlug: z.string(),
        venueGroupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: venues.id,
          slug: venues.slug,
          name: venues.name,
          venueGroupName: venues.venueGroupName,
          description: venues.description,
          status: venues.status,
          thumbnailImageUrl: venues.thumbnailImageUrl,
          capacitySeated: venues.capacitySeated,
          capacityStanding: venues.capacityStanding,
          capacityMin: venues.capacityMin,
          capacityMax: venues.capacityMax,
        })
        .from(venues)
        .innerJoin(cities, eq(venues.cityId, cities.id))
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(
          and(
            eq(countries.slug, input.countrySlug),
            eq(cities.slug, input.citySlug),
            eq(venues.venueGroupId, input.venueGroupId),
          ),
        );
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.query.venues.findFirst({
        where: eq(venues.slug, input.slug),
        with: {
          floorPlans: {
            with: { tableAreas: true, stages: true, doorAreas: true },
          },
          eventThemes: true,
        },
      });
      return venue ?? null;
    }),

  defaultFloorPlan: publicProcedure
    .input(z.object({ venueSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.query.venues.findFirst({
        where: eq(venues.slug, input.venueSlug),
      });
      if (!venue?.defaultFloorPlanId) return null;
      return ctx.db.query.floorPlans.findFirst({
        where: eq(floorPlans.id, venue.defaultFloorPlanId),
        with: {
          tableAreas: true,
          stages: true,
          doorAreas: true,
          technicalMarkings: true,
        },
      });
    }),
});
