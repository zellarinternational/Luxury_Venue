import { randomBytes } from "crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { sharedConfigs } from "../../db/schema";

const SHORT_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/l/I — avoids visual ambiguity in a shared link
const SHORT_CODE_LENGTH = 8;
const MAX_SHORT_CODE_ATTEMPTS = 5;

function generateShortCode(): string {
  const bytes = randomBytes(SHORT_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
  }
  return code;
}

const seatingModeSchema = z.enum(["auto", "tables-only", "chairs-only"]);

const sharedConfigInput = z.object({
  venueId: z.string().uuid(),
  floorPlanId: z.string().uuid(),
  guestCount: z.number().int().min(0),
  seatingMode: seatingModeSchema.nullable(),
  selectedTableAreaId: z.string().uuid().nullable(),
  customTableArea: z.record(z.string(), z.unknown()).nullable(),
  selectedStageId: z.string().uuid().nullable(),
});

export const sharedConfigsRouter = router({
  create: publicProcedure.input(sharedConfigInput).mutation(async ({ ctx, input }) => {
    for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();
      try {
        const [row] = await ctx.db
          .insert(sharedConfigs)
          .values({ ...input, shortCode })
          .returning();
        return row;
      } catch (err) {
        // Unique-violation on short_code — vanishingly unlikely at this
        // keyspace, but the legacy app retried unbounded; cap it instead.
        const isUniqueViolation = err instanceof Error && "code" in err && (err as { code?: string }).code === "23505";
        if (!isUniqueViolation) throw err;
      }
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate a unique share code" });
  }),

  getByShortCode: publicProcedure.input(z.object({ shortCode: z.string() })).query(async ({ ctx, input }) => {
    const row = await ctx.db.query.sharedConfigs.findFirst({
      where: eq(sharedConfigs.shortCode, input.shortCode),
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
    return row;
  }),

  /**
   * Optimistic concurrency: the update only applies if `expectedVersion`
   * still matches the row's current version, and bumps it atomically in the
   * same statement. The legacy app had no equivalent — two editors (or a
   * stale in-flight request) could race a full-file read-modify-write and
   * silently discard each other's changes. Here a losing writer gets a
   * CONFLICT back and must refetch the latest version before retrying.
   */
  update: publicProcedure
    .input(sharedConfigInput.partial().extend({ shortCode: z.string(), expectedVersion: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { shortCode, expectedVersion, ...fields } = input;
      const [row] = await ctx.db
        .update(sharedConfigs)
        .set({ ...fields, version: sql`${sharedConfigs.version} + 1`, updatedAt: new Date() })
        .where(and(eq(sharedConfigs.shortCode, shortCode), eq(sharedConfigs.version, expectedVersion)))
        .returning();

      if (!row) {
        const current = await ctx.db.query.sharedConfigs.findFirst({ where: eq(sharedConfigs.shortCode, shortCode) });
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        throw new TRPCError({ code: "CONFLICT", message: "This share was updated elsewhere" });
      }
      return row;
    }),
});
