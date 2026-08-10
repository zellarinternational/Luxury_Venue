import { trpcVanilla } from "@/lib/trpc-vanilla";
import { getAssetUrl } from "@/lib/assets";
import type { FloorPlanGeometry, FloorPlanGeometrySource, StageGeometry } from "../types";
import type { TableConfig } from "../../placement/types";
import type { DoorArea } from "../../placement/doorAreas";

/**
 * DB-backed geometry source. Placement geometry (table-area polygons, door
 * areas, stage positions) was already normalized out of the legacy DXF
 * config at Phase 2 seed time (server/db/seed/migrate-from-legacy.ts) — this
 * only needs to fetch and reshape it, not parse any DXF file. The DXF file
 * itself (dxfAssetUrl) is only consumed by ./DxfFloorPlanVisual for the
 * visual 2D render, a separate concern from placement geometry.
 */
export const dxfGeometrySource: FloorPlanGeometrySource = {
  async loadGeometry(floorPlanId: string): Promise<FloorPlanGeometry> {
    const floorPlan = await trpcVanilla.floorPlans.getById.query({ floorPlanId });
    if (!floorPlan) {
      throw new Error(`Floor plan ${floorPlanId} not found`);
    }

    // tableConfig jsonb holds the full legacy TableConfig shape (width,
    // height, chairsPerTable, spacing, singleChair, etc); the dedicated
    // polygon/seatingMode columns are the authoritative source for those two
    // fields specifically (see server/db/seed/migrate-from-legacy.ts).
    const tableAreas = floorPlan.tableAreas.map(
      (ta) =>
        ({
          ...((ta.tableConfig ?? {}) as Record<string, unknown>),
          id: ta.id,
          namedPoints: ta.polygon ?? undefined,
          seatingMode: ta.seatingMode,
        }) as unknown as TableConfig,
    );

    const doorAreas: DoorArea[] = floorPlan.doorAreas
      .filter((d): d is typeof d & { polygon: NonNullable<typeof d.polygon> } => d.polygon != null)
      .map((d) => ({ id: d.id, polygon: d.polygon, clearance: d.clearance ?? undefined }));

    const stages: StageGeometry[] = floorPlan.stages.map((s) => ({
      id: s.id,
      name: s.name,
      dxfAssetUrl: getAssetUrl(s.dxfAssetUrl),
      glbAssetUrl: getAssetUrl(s.glbAssetUrl),
      x: s.x ?? 0,
      y: s.y ?? 0,
      rotation: s.rotation ?? 0,
      width: s.width ?? 0,
      depth: s.depth ?? 0,
      backstageDepth: s.backstageDepth,
      backstageSide: s.backstageSide,
      position3D: s.position3D,
    }));

    return {
      floorPlanId: floorPlan.id,
      name: floorPlan.name,
      dxfAssetUrl: getAssetUrl(floorPlan.dxfAssetUrl),
      glbAssetUrl: getAssetUrl(floorPlan.glbAssetUrl),
      dxfUnits: floorPlan.dxfUnits ?? "inches",
      scaleFactor: floorPlan.scaleFactor,
      bounds: floorPlan.bounds,
      positionOffset3D: floorPlan.positionOffset3D,
      tableAreas,
      doorAreas,
      stages,
    };
  },
};
