import { router } from "./trpc";
import { countriesRouter } from "./routers/countries";
import { citiesRouter } from "./routers/cities";
import { venuesRouter } from "./routers/venues";
import { floorPlansRouter } from "./routers/floorPlans";

export const appRouter = router({
  countries: countriesRouter,
  cities: citiesRouter,
  venues: venuesRouter,
  floorPlans: floorPlansRouter,
});

export type AppRouter = typeof appRouter;
