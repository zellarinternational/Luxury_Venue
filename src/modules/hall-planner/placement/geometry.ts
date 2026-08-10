export interface Point {
  x: number;
  y: number;
}

export interface Polygon4 {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function polygonToArray(polygon: Polygon4): Point[] {
  return [polygon.topLeft, polygon.topRight, polygon.bottomRight, polygon.bottomLeft];
}

export function getPolygonBounds(polygon: Point[]): Bounds {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function isPointOnSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > Number.EPSILON) return false;

  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;

  const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (dot > lenSq) return false;

  return true;
}

/**
 * Ray-casting point-in-polygon test with boundary inclusion (a point exactly
 * on an edge counts as inside). Merged from the two divergent legacy
 * implementations in tableCalculator.ts (boundary-inclusive) and venues.ts
 * (used for real corner-containment checks) — this is now the single
 * source of truth for both concerns.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    if (isPointOnSegment(point, pj, pi)) return true;

    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * True only if every corner of the given rectangle (center x/y + width/height)
 * falls inside the polygon. The legacy tableCalculator.ts placement loops
 * never did this — they only checked the polygon's axis-aligned bounding box,
 * so a non-rectangular table area (e.g. a custom-drawn quadrilateral) could
 * place furniture outside the actual shape. venues.ts had this check but was
 * dead code (never imported by the live placement path). This merges the two:
 * the live control flow now gets the correct geometry primitive.
 */
export function areRectCornersInPolygon(
  rect: { x: number; y: number; width: number; height: number },
  polygon: Point[],
): boolean {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const corners: Point[] = [
    { x: rect.x - halfW, y: rect.y - halfH },
    { x: rect.x + halfW, y: rect.y - halfH },
    { x: rect.x + halfW, y: rect.y + halfH },
    { x: rect.x - halfW, y: rect.y + halfH },
  ];
  return corners.every((c) => isPointInPolygon(c, polygon));
}
