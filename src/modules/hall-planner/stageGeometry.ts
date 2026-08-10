const MAX_BACKSTAGE_DEPTH_FEET = 10;

function feetToDxfUnits(feet: number, dxfUnits: string): number {
  const feetInMeters = feet * 0.3048;
  switch (dxfUnits) {
    case "meters":
      return feetInMeters;
    case "millimeters":
      return feetInMeters * 1000;
    case "centimeters":
      return feetInMeters * 100;
    case "kilometers":
      return feetInMeters / 1000;
    case "feet":
      return feet;
    case "inches":
    default:
      return feet * 12;
  }
}

export interface StagePlacementInput {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  backstageDepth?: number | null;
}

/**
 * A stage's stored (x, y) is its top-center anchor, not its geometric
 * center — confirmed from the legacy app's actual DXF-model placement code
 * (src/components/Canvas/HallCanvas2D.tsx's "Render DXF model stage"
 * branch), which computes the true center as
 * `y - visualHeight / 2` where `visualHeight` is the rotated bounding
 * height `|width*sin(rotation)| + |depth*cos(rotation)|`.
 *
 * The port originally (Phase 4b) rendered stages by treating the stored
 * (x, y) as a center directly. For a stage rotated 90 degrees, that put the
 * center ~half the stage *width* too far in Y (587 DXF units off, for
 * Infinity Ballroom's "Sample Stage 1") — enough to place the stage
 * hundreds of units outside the room, which is exactly the "stages going
 * out of the 2D floor plan" bug. Both HallCanvas2D and the 3D scene must
 * use this same function so 2D and 3D stay consistent.
 */
export function stageVisualCenter(stage: StagePlacementInput, dxfUnits: string): { x: number; y: number } {
  const rotRad = (stage.rotation * Math.PI) / 180;
  const visualHeight = Math.abs(stage.width * Math.sin(rotRad)) + Math.abs(stage.depth * Math.cos(rotRad));
  const backstageFeet = Math.min(MAX_BACKSTAGE_DEPTH_FEET, stage.backstageDepth ?? 0);
  const xOffset = feetToDxfUnits(backstageFeet, dxfUnits);
  return { x: stage.x + xOffset, y: stage.y - visualHeight / 2 };
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * We render a stage as a flat, opaque `width x depth` rectangle rather than
 * its real (often non-rectangular — runway, lighting truss allowances, etc.)
 * DXF artwork. Combined with `stageVisualCenter`'s top-center anchor, that
 * rectangle can extend past the room's actual walls — for Infinity
 * Ballroom's "Sample Stage 1", the stored width (1175) alone is *larger*
 * than the whole room's depth (~1030), so no repositioning alone can keep
 * it inside; the box itself has to shrink to fit. This is the tradeoff of
 * the simplified-shape rendering approach (matching how tables/chairs are
 * deliberately rendered as clean circles, not their real geometry, per
 * HallCanvas2D's doc comment) — visually correct containment over exact
 * stored dimensions.
 *
 * Shrinks (uniformly, preserving aspect ratio) only if the stage's rotated
 * bounding box doesn't fit within `room`, then clamps the center so every
 * edge stays inside the walls (with a small margin so it doesn't visually
 * touch them).
 */
export function fitStageToRoom(
  stage: StagePlacementInput,
  dxfUnits: string,
  room: RoomBounds,
  marginRatio = 0.96,
): { x: number; y: number; width: number; depth: number } {
  const rotRad = (stage.rotation * Math.PI) / 180;
  const center = stageVisualCenter(stage, dxfUnits);

  const roomWidth = (room.maxX - room.minX) * marginRatio;
  const roomHeight = (room.maxY - room.minY) * marginRatio;

  const visualWidth = Math.abs(stage.width * Math.cos(rotRad)) + Math.abs(stage.depth * Math.sin(rotRad));
  const visualHeight = Math.abs(stage.width * Math.sin(rotRad)) + Math.abs(stage.depth * Math.cos(rotRad));

  const scale = Math.min(1, roomWidth / visualWidth, roomHeight / visualHeight);
  const width = stage.width * scale;
  const depth = stage.depth * scale;
  const halfW = (visualWidth * scale) / 2;
  const halfH = (visualHeight * scale) / 2;

  const x = Math.min(Math.max(center.x, room.minX + halfW), room.maxX - halfW);
  const y = Math.min(Math.max(center.y, room.minY + halfH), room.maxY - halfH);

  return { x, y, width, depth };
}
