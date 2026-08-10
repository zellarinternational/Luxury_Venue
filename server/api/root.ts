import { router } from "./trpc";
import { countriesRouter } from "./routers/countries";

export const appRouter = router({
  countries: countriesRouter,
});

export type AppRouter = typeof appRouter;
