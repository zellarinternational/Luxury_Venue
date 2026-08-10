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
        with: { tableAreas: true, stages: true, doorAreas: true, technicalMarkings: true },
      });
    }),
});
