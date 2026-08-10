export interface Point2D {
  x: number;
  y: number;
}

export interface Polygon4 {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface TableAreaPolygon {
  id: string;
  polygon: Polygon4;
  seatingMode: "auto" | "tables-only" | "chairs-only";
}

export interface DoorAreaPolygon {
  id: string;
  polygon: Polygon4;
  clearance?: number;
}

export interface StagePolygon {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
}

export interface FloorPlanGeometry {
  floorPlanId: string;
  scaleFactor: number;
  origin: Point2D;
  bounds: Polygon4;
  tableAreas: TableAreaPolygon[];
  doorAreas: DoorAreaPolygon[];
  stage: StagePolygon | null;
}

/**
 * The only contract that src/modules/hall-planner/placement and
 * src/modules/hall-planner/scene are allowed to depend on. The current
 * implementation (./dxf) wraps dxf-viewer; a future native in-app editor
 * becomes a second implementation of this same interface with zero changes
 * required in placement or scene code. Enforced by .dependency-cruiser.cjs.
 */
export interface FloorPlanGeometrySource {
  loadGeometry(floorPlanId: string): Promise<FloorPlanGeometry>;
}
