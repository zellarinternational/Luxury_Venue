import { asc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { countries } from "../../db/schema";

export const countriesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(countries).orderBy(asc(countries.order));
  }),
});
