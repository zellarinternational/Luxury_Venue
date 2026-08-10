"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useHallStore } from "../store";
import type { SeatingMode, TableConfig } from "../placement/types";

const PUBLISH_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 5000;

interface SharedFields {
  guestCount: number;
  seatingMode: SeatingMode | null;
  selectedTableAreaId: string | null;
  customTableArea: TableConfig | null;
  selectedStageId: string | null;
}

function fieldsEqual(a: SharedFields, b: SharedFields): boolean {
  return (
    a.guestCount === b.guestCount &&
    a.seatingMode === b.seatingMode &&
    a.selectedTableAreaId === b.selectedTableAreaId &&
    a.selectedStageId === b.selectedStageId &&
    JSON.stringify(a.customTableArea) === JSON.stringify(b.customTableArea)
  );
}

/**
 * Publishes local hall-planner edits to a shared_configs row, debounced,
 * using optimistic concurrency (server/api/routers/sharedConfigs.ts).
 *
 * This — plus useSharedConfigPoll below — replaces the legacy app's
 * `useWebSocket()`/`websocketManager.ts`, which despite the name was an
 * `EventSource` triggering a full refetch, backed by an in-memory `Map`
 * that doesn't survive across serverless instances, writing a flat JSON
 * file with no locking (last-write-wins, silently). This is honestly named
 * for what it does (periodic push/pull, not a persistent connection), and
 * the optimistic-concurrency version check means a losing writer finds out
 * instead of silently clobbering someone else's edit.
 */
export function useSharedConfigPublish(params: { shortCode: string | null; venueId: string | null; initialVersion: number | null }) {
  const { shortCode, venueId, initialVersion } = params;
  const guestCount = useHallStore((s) => s.guestCount);
  const seatingModeOverride = useHallStore((s) => s.seatingModeOverride);
  const selectedTableAreaId = useHallStore((s) => s.selectedTableAreaId);
  const customTableArea = useHallStore((s) => s.customTableArea);
  const selectedStageId = useHallStore((s) => s.selectedStageId);
  const geometry = useHallStore((s) => s.geometry);

  const versionRef = useRef<number | null>(initialVersion);
  const lastSyncedRef = useRef<SharedFields | null>(null);
  const inFlightRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  // Bumped in onSettled so the publish effect below re-evaluates once an
  // in-flight mutation finishes — see the in-flight guard's comment for why.
  const [settledTick, setSettledTick] = useState(0);

  useEffect(() => {
    versionRef.current = initialVersion;
    // Seed with the just-hydrated values, not null — otherwise the first
    // evaluation below sees no "last synced" baseline, treats the freshly
    // *received* state as a pending local change, and echoes it straight
    // back as a no-op update. If a genuine edit from elsewhere lands in the
    // narrow window before that echo fires, the echo's stale expectedVersion
    // can still win the race and silently overwrite the real edit — the
    // same class of bug (last-write-wins data loss) this whole module
    // exists to fix, just from the "viewer" side instead of the "editor"
    // side of a share.
    lastSyncedRef.current =
      initialVersion == null
        ? null
        : {
            guestCount,
            seatingMode: seatingModeOverride,
            selectedTableAreaId: selectedTableAreaId === "__custom__" ? null : selectedTableAreaId,
            customTableArea,
            selectedStageId,
          };
    setConflict(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, initialVersion]);

  const utils = trpc.useUtils();
  const mutation = trpc.sharedConfigs.update.useMutation({
    onSuccess: (row) => {
      versionRef.current = row.version;
      utils.sharedConfigs.getByShortCode.setData({ shortCode: row.shortCode }, row);
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") setConflict(true);
    },
    onSettled: () => {
      inFlightRef.current = false;
      setSettledTick((t) => t + 1);
    },
  });

  useEffect(() => {
    if (!shortCode || !venueId || !geometry || versionRef.current == null) return;
    // A push is already in flight — don't race it with a second request
    // carrying the same (soon-to-be-stale) expectedVersion, which would get
    // spuriously rejected as a conflict even though nothing external
    // changed. onSettled above bumps settledTick, which re-runs this effect
    // once the in-flight request resolves, so the change below isn't lost.
    if (inFlightRef.current) return;

    const fields: SharedFields = {
      guestCount,
      seatingMode: seatingModeOverride,
      selectedTableAreaId: selectedTableAreaId === "__custom__" ? null : selectedTableAreaId,
      customTableArea: customTableArea,
      selectedStageId,
    };
    if (lastSyncedRef.current && fieldsEqual(lastSyncedRef.current, fields)) return;

    const timer = setTimeout(() => {
      if (inFlightRef.current) return;
      lastSyncedRef.current = fields;
      inFlightRef.current = true;
      mutation.mutate({
        shortCode,
        expectedVersion: versionRef.current!,
        venueId,
        floorPlanId: geometry.floorPlanId,
        guestCount: fields.guestCount,
        seatingMode: fields.seatingMode,
        selectedTableAreaId: fields.selectedTableAreaId,
        customTableArea: fields.customTableArea as Record<string, unknown> | null,
        selectedStageId: fields.selectedStageId,
      });
    }, PUBLISH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, venueId, geometry, guestCount, seatingModeOverride, selectedTableAreaId, customTableArea, selectedStageId, settledTick]);

  return { conflict, markConflictHandled: () => setConflict(false) };
}

/**
 * Polls for remote changes to a shared config (e.g. from another viewer's
 * tab) and hands the caller the fresh row whenever its version has moved
 * past what's already been applied locally.
 */
export function useSharedConfigPoll(shortCode: string | null, knownVersion: number | null, onRemoteChange: (version: number) => void) {
  const query = trpc.sharedConfigs.getByShortCode.useQuery(
    { shortCode: shortCode ?? "" },
    { enabled: !!shortCode, refetchInterval: POLL_INTERVAL_MS },
  );

  useEffect(() => {
    if (!query.data || knownVersion == null) return;
    if (query.data.version > knownVersion) onRemoteChange(query.data.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data?.version]);

  return query;
}
