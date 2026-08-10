import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { countries } from "../../db/schema";

export const countriesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(countries).orderBy(asc(countries.order));
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [country] = await ctx.db
        .select()
        .from(countries)
        .where(eq(countries.slug, input.slug))
        .limit(1);
      return country ?? null;
    }),
});
