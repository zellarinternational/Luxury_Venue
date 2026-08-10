import type { Polygon4 } from "../placement/geometry";
import type { TableConfig } from "../placement/types";
import type { DoorArea } from "../placement/doorAreas";

export type { Polygon4 };

export interface StageGeometry {
  id: string;
  name: string;
  dxfAssetUrl?: string | null;
  glbAssetUrl?: string | null;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  backstageDepth?: number | null;
  backstageSide?: string | null;
  position3D?: { x: number; y: number; z: number } | null;
}

export interface FloorPlanGeometry {
  floorPlanId: string;
  name: string;
  dxfAssetUrl: string | null;
  glbAssetUrl: string | null;
  dxfUnits: string;
  scaleFactor: number | null;
  bounds: Polygon4 | null;
  positionOffset3D: { x: number; y: number; z: number } | null;
  /** Full table configs (not just polygons) — placement needs width/spacing/singleChair/etc, not just the area shape. */
  tableAreas: TableConfig[];
  doorAreas: DoorArea[];
  stages: StageGeometry[];
}

/**
 * The only contract that src/modules/hall-planner/placement and
 * src/modules/hall-planner/scene are allowed to depend on. The current
 * implementation (./dxf) wraps dxf-viewer for the *visual* floor-plan render
 * and fetches structured geometry from the DB (already normalized out of
 * DXF by the Phase 2 seed, so placement never needs to parse a DXF file). A
 * future native in-app editor becomes a second implementation of this same
 * interface with zero changes required in placement or scene code. Enforced
 * by .dependency-cruiser.cjs.
 */
export interface FloorPlanGeometrySource {
  loadGeometry(floorPlanId: string): Promise<FloorPlanGeometry>;
}
