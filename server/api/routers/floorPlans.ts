import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { floorPlans } from "../../db/schema";

export const floorPlansRouter = router({
  getById: publicProcedure
    .input(z.object({ floorPlanId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const floorPlan = await ctx.db.query.floorPlans.findFirst({
        where: eq(floorPlans.id, input.floorPlanId),
        with: {
          tableAreas: true,
          stages: true,
          doorAreas: true,
          technicalMarkings: true,
        },
      });
      return floorPlan ?? null;
    }),
});
