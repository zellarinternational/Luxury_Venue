import type { Bounds, Polygon4 } from "./geometry";

export interface DoorArea {
  id: string;
  polygon: Polygon4;
  clearance?: number;
}

/**
 * AABB of a door area, expanded by its clearance. Note: like the legacy
 * implementation this ports, this is axis-aligned only — a rotated door
 * polygon is treated as its unrotated bounding box. Fixing that is a real
 * geometry improvement but out of scope for this port (tracked, not solved).
 */
export function getDoorAreaBounds(door: DoorArea): Bounds {
  const clearance = door.clearance ?? 0;
  const { topLeft, topRight, bottomRight, bottomLeft } = door.polygon;
  const xs = [topLeft.x, topRight.x, bottomRight.x, bottomLeft.x];
  const ys = [topLeft.y, topRight.y, bottomRight.y, bottomLeft.y];
  return {
    minX: Math.min(...xs) - clearance,
    maxX: Math.max(...xs) + clearance,
    minY: Math.min(...ys) - clearance,
    maxY: Math.max(...ys) + clearance,
  };
}

export interface PlacementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectOverlapsBounds(rect: PlacementRect, bounds: Bounds): boolean {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const minX = rect.x - halfW;
  const maxX = rect.x + halfW;
  const minY = rect.y - halfH;
  const maxY = rect.y + halfH;
  return !(maxX < bounds.minX || minX > bounds.maxX || maxY < bounds.minY || minY > bounds.maxY);
}

export function isObjectInAnyDoorArea(rect: PlacementRect, doorAreas: DoorArea[]): boolean {
  return doorAreas.some((door) => rectOverlapsBounds(rect, getDoorAreaBounds(door)));
}

export function getDoorAreaAtPosition(
  rect: PlacementRect,
  doorAreas: DoorArea[],
): { door: DoorArea; bounds: Bounds } | null {
  for (const door of doorAreas) {
    const bounds = getDoorAreaBounds(door);
    if (rectOverlapsBounds(rect, bounds)) return { door, bounds };
  }
  return null;
}
