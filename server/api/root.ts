import { router } from "./trpc";
import { countriesRouter } from "./routers/countries";
import { citiesRouter } from "./routers/cities";
import { venuesRouter } from "./routers/venues";

export const appRouter = router({
  countries: countriesRouter,
  cities: citiesRouter,
  venues: venuesRouter,
});

export type AppRouter = typeof appRouter;
