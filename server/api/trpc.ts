import { initTRPC } from "@trpc/server";
import { db } from "../db/client";

export function createTRPCContext() {
  return { db };
}

type Context = ReturnType<typeof createTRPCContext>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
