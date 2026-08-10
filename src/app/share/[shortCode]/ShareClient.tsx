"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@server/api/root";
import { dxfGeometrySource } from "@/modules/hall-planner/geometry-source";
import { useHallStore } from "@/modules/hall-planner/store";
import { HallControls } from "@/modules/hall-planner/HallControls";
import { useSharedConfigPoll, useSharedConfigPublish } from "@/modules/hall-planner/sharing/useSharedConfigSync";
import { Button } from "@/design-system/components/Button";
import type { TableConfig } from "@/modules/hall-planner/placement/types";

type SharedConfigRow = NonNullable<inferRouterOutputs<AppRouter>["sharedConfigs"]["getByShortCode"]>;

const HallCanvas2D = dynamic(
  () => import("@/modules/hall-planner/scene/HallCanvas2D").then((m) => m.HallCanvas2D),
  { ssr: false },
);
const HallCanvas3D = dynamic(
  () => import("@/modules/hall-planner/scene/HallCanvas3D").then((m) => m.HallCanvas3D),
  { ssr: false },
);

export function ShareClient({ shortCode }: { shortCode: string }) {
  const loadGeometry = useHallStore((s) => s.loadGeometry);
  const applySharedState = useHallStore((s) => s.applySharedState);
  const reset = useHallStore((s) => s.reset);
  const viewMode = useHallStore((s) => s.viewMode);

  const [appliedVersion, setAppliedVersion] = useState<number | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const loadedFloorPlanId = useRef<string | null>(null);
  const applyRowRef = useRef<(row: SharedConfigRow) => void>(() => {});

  applyRowRef.current = (row: SharedConfigRow) => {
    const apply = () =>
      applySharedState({
        guestCount: row.guestCount ?? 0,
        seatingMode: row.seatingMode,
        selectedTableAreaId: row.selectedTableAreaId,
        customTableArea: row.customTableArea as TableConfig | null,
        selectedStageId: row.selectedStageId,
      });

    if (loadedFloorPlanId.current === row.floorPlanId) {
      apply();
      setAppliedVersion(row.version);
      return;
    }

    loadedFloorPlanId.current = row.floorPlanId;
    dxfGeometrySource
      .loadGeometry(row.floorPlanId)
      .then((geometry) => {
        loadGeometry(geometry);
        apply();
        setAppliedVersion(row.version);
      })
      .catch((err) => setGeometryError(err instanceof Error ? err.message : String(err)));
  };

  const configQuery = useSharedConfigPoll(shortCode, appliedVersion, () => {
    if (configQuery.data) applyRowRef.current(configQuery.data);
  });

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode]);

  useEffect(() => {
    if (configQuery.data && appliedVersion == null) applyRowRef.current(configQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data]);

  const { conflict, markConflictHandled } = useSharedConfigPublish({
    shortCode,
    venueId: configQuery.data?.venueId ?? null,
    initialVersion: appliedVersion,
  });

  if (configQuery.isLoading) return <EmptyState title="Loading shared layout…" />;
  if (!configQuery.data) return <EmptyState title="Share not found" message="This link may have expired." />;
  if (geometryError) return <EmptyState title="Failed to load floor plan" message={geometryError} />;
  if (appliedVersion == null) return <EmptyState title="Loading shared layout…" />;

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <HallControls venueId={configQuery.data.venueId} />
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <Link href="/">
            <Button variant="secondary" size="sm">
              ← Back
            </Button>
          </Link>
          {conflict ? (
            <button
              onClick={() => {
                markConflictHandled();
                if (configQuery.data) applyRowRef.current(configQuery.data);
              }}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-0)]"
            >
              Updated elsewhere — click to refresh
            </button>
          ) : null}
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
