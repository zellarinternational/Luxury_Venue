import { appRouter } from "./root";
import { createTRPCContext } from "./trpc";

/**
 * Server-side tRPC caller for use in React Server Components — no HTTP
 * round trip, same typed procedures as the client. Client components that
 * need interactivity (filters, mutations) should use the `trpc` react-query
 * hooks from src/lib/trpc.ts instead.
 */
export function getServerCaller() {
  return appRouter.createCaller(createTRPCContext());
}
