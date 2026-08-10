import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { cities, countries } from "../../db/schema";

export const citiesRouter = router({
  listByCountry: publicProcedure
    .input(z.object({ countrySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: cities.id,
          slug: cities.slug,
          name: cities.name,
          tagline: cities.tagline,
          heroImageUrl: cities.heroImageUrl,
        })
        .from(cities)
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(eq(countries.slug, input.countrySlug));
    }),

  getBySlug: publicProcedure
    .input(z.object({ countrySlug: z.string(), citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [city] = await ctx.db
        .select({
          id: cities.id,
          slug: cities.slug,
          name: cities.name,
          tagline: cities.tagline,
          heroTitle: cities.heroTitle,
          heroSubtitle: cities.heroSubtitle,
          heroImageUrl: cities.heroImageUrl,
        })
        .from(cities)
        .innerJoin(countries, eq(cities.countryId, countries.id))
        .where(
          and(
            eq(countries.slug, input.countrySlug),
            eq(cities.slug, input.citySlug),
          ),
        )
        .limit(1);
      return city ?? null;
    }),
});
