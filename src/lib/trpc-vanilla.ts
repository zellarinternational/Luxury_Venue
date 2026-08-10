import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@server/api/root";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Imperative (non-hook) tRPC client for use outside React components — e.g.
 * geometry-source implementations, which expose plain async functions, not
 * hooks. Use src/lib/trpc.ts (react-query hooks) inside components instead.
 */
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${getBaseUrl()}/api/trpc` })],
});
