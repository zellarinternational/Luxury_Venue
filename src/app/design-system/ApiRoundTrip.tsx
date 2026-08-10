"use client";

import { trpc } from "@/lib/trpc";

export function ApiRoundTrip() {
  const { data, isLoading, error } = trpc.countries.list.useQuery();

  if (isLoading)
    return <p className="text-[var(--color-text-muted)]">Loading countries…</p>;
  if (error)
    return (
      <p className="text-[var(--color-accent-700)]">
        API error: {error.message} (expected until DB is seeded — see
        server/db/seed)
      </p>
    );
  return (
    <p className="text-[var(--color-text-muted)]">
      Loaded {data?.length ?? 0} countries via tRPC → Drizzle → Postgres.
    </p>
  );
}
