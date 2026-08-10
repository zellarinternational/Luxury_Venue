/**
 * Single source of truth for DXF-unit <-> 3D-world-unit conversion.
 *
 * The legacy app reimplemented `x = (dxfX - centerX) / scaleFactor` (and its
 * inverse) independently across HallCanvas3DGlobal, HallCanvas3DWalk,
 * OptimizedStageAndEvents, etc. Several of those copies hardcoded
 * `scaleFactor = 47.5` instead of consuming the dynamically computed value,
 * so tables/chairs/stage silently drifted out of alignment with the floor
 * model whenever the real scale differed from 47.5. Routing every 3D
 * placement through these two functions with one shared `SceneTransform`
 * (see store.ts's `scaleFactor`/`sceneCenter`) makes that bug class
 * structurally impossible: there is nowhere left for a second copy of the
 * math to diverge.
 */

export interface SceneTransform {
  /** DXF-unit point that maps to world (0, 0). */
  center: { x: number; y: number };
  /** DXF units per 3D-world unit. */
  scaleFactor: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export function dxfToWorld(point: { x: number; y: number }, transform: SceneTransform): WorldPoint {
  return {
    x: (point.x - transform.center.x) / transform.scaleFactor,
    // DXF Y grows downward on the drawing; world Z grows toward the camera, so it's inverted.
    z: -(point.y - transform.center.y) / transform.scaleFactor,
  };
}

export function worldToDxf(point: WorldPoint, transform: SceneTransform): { x: number; y: number } {
  return {
    x: point.x * transform.scaleFactor + transform.center.x,
    y: -point.z * transform.scaleFactor + transform.center.y,
  };
}

export function dxfLengthToWorld(length: number, transform: SceneTransform): number {
  return length / transform.scaleFactor;
}

/**
 * Auto-derive the DXF-units-per-world-unit scale factor from a floor GLB's
 * physical footprint vs. the floor plan's real DXF-unit bounds. Ported from
 * the legacy app's Walk-mode calculation (the more refined of its two
 * duplicated versions): callers pass in the bounding size of the GLB's
 * single largest-footprint mesh (to ignore outlier/environment meshes),
 * not the whole scene's bounding box.
 */
export function calculateScaleFactor(
  glbFootprint: { width: number; depth: number },
  dxfBounds: { width: number; height: number },
): number {
  const scaleFactorX = dxfBounds.width / glbFootprint.width;
  const scaleFactorZ = dxfBounds.height / glbFootprint.depth;
  return Math.max(scaleFactorX, scaleFactorZ);
}
