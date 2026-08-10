"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { dxfGeometrySource } from "@/modules/hall-planner/geometry-source";
import { useHallStore } from "@/modules/hall-planner/store";
import { HallControls } from "@/modules/hall-planner/HallControls";
import { Button } from "@/design-system/components/Button";

// Three.js needs the browser — same reasoning the old app used for its canvas imports.
const HallCanvas2D = dynamic(
  () => import("@/modules/hall-planner/scene/HallCanvas2D").then((m) => m.HallCanvas2D),
  { ssr: false },
);
const HallCanvas3D = dynamic(
  () => import("@/modules/hall-planner/scene/HallCanvas3D").then((m) => m.HallCanvas3D),
  { ssr: false },
);

export function HallClient() {
  const searchParams = useSearchParams();
  const venueSlug = searchParams.get("venue");
  const loadGeometry = useHallStore((s) => s.loadGeometry);
  const reset = useHallStore((s) => s.reset);
  const viewMode = useHallStore((s) => s.viewMode);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [geometryLoading, setGeometryLoading] = useState(false);

  const venueQuery = trpc.venues.getBySlug.useQuery(
    { slug: venueSlug ?? "" },
    { enabled: !!venueSlug },
  );

  const defaultFloorPlanId = venueQuery.data?.defaultFloorPlanId ?? null;

  useEffect(() => {
    reset();
    if (!defaultFloorPlanId) return;

    let cancelled = false;
    setGeometryLoading(true);
    setGeometryError(null);

    dxfGeometrySource
      .loadGeometry(defaultFloorPlanId)
      .then((geometry) => {
        if (cancelled) return;
        loadGeometry(geometry);
      })
      .catch((err) => {
        if (cancelled) return;
        setGeometryError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setGeometryLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFloorPlanId]);

  if (!venueSlug) {
    return (
      <EmptyState
        title="No venue selected"
        message="Open this page with a venue, e.g. /hall?venue=infinity-ballroom."
      />
    );
  }

  if (venueQuery.isLoading) {
    return <EmptyState title="Loading venue…" />;
  }

  if (!venueQuery.data) {
    return <EmptyState title="Venue not found" message={`No venue with slug "${venueSlug}".`} />;
  }

  if (venueQuery.data.status === "coming_soon") {
    return (
      <EmptyState
        title={`${venueQuery.data.name} is coming soon`}
        message="This hallroom doesn't have a plannable floor plan yet."
      />
    );
  }

  if (geometryError) {
    return <EmptyState title="Failed to load floor plan" message={geometryError} />;
  }

  if (geometryLoading || !defaultFloorPlanId) {
    return <EmptyState title="Loading floor plan…" />;
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <HallControls />
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10">
          <Link href="/">
            <Button variant="secondary" size="sm">
              ← Back
            </Button>
          </Link>
        </div>
        {viewMode === "2d" ? <HallCanvas2D /> : <HallCanvas3D mode={viewMode} />}
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-background)] text-[var(--color-foreground)] p-8 text-center">
      <h1 className="text-xl font-medium font-[family-name:var(--font-display)]">{title}</h1>
      {message ? <p className="text-[var(--color-text-muted)] max-w-md">{message}</p> : null}
      <Link href="/">
        <Button variant="secondary" size="sm">
          Back to home
        </Button>
      </Link>
    </div>
  );
}
