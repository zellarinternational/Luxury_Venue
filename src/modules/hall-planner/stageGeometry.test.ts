import { describe, expect, it } from "vitest";
import { fitStageToRoom, stageVisualCenter } from "./stageGeometry";

// Real data: Infinity Ballroom's "Sample Stage 1" and its floor plan bounds
// (server/db/seed/data/venues-real.json). Before the fix, this stage's
// rotated bounding box spanned Y 951 to 2126 against a room spanning only
// 1055 to 2085 — sticking out both above and below the walls.
const stage1 = { x: 930, y: 2126, width: 1175, depth: 451, rotation: 90, backstageDepth: 10 };
const room = { minX: 710, maxX: 3000, minY: 1055, maxY: 2085 };

describe("stageVisualCenter", () => {
  it("treats (x, y) as top-center, not the geometric center", () => {
    const center = stageVisualCenter(stage1, "inches");
    // visualHeight at rotation=90 is width (1175); center.y = y - visualHeight/2
    expect(center.y).toBeCloseTo(2126 - 1175 / 2, 5);
    // x gets the backstage offset added (10ft capped, 10*12 = 120 inches)
    expect(center.x).toBeCloseTo(930 + 120, 5);
  });
});

describe("fitStageToRoom", () => {
  it("keeps every edge of the rotated stage inside the room bounds", () => {
    const fitted = fitStageToRoom(stage1, "inches", room);
    const rotRad = (stage1.rotation * Math.PI) / 180;
    const visualWidth = Math.abs(fitted.width * Math.cos(rotRad)) + Math.abs(fitted.depth * Math.sin(rotRad));
    const visualHeight = Math.abs(fitted.width * Math.sin(rotRad)) + Math.abs(fitted.depth * Math.cos(rotRad));

    expect(fitted.x - visualWidth / 2).toBeGreaterThanOrEqual(room.minX);
    expect(fitted.x + visualWidth / 2).toBeLessThanOrEqual(room.maxX);
    expect(fitted.y - visualHeight / 2).toBeGreaterThanOrEqual(room.minY - 1e-6);
    expect(fitted.y + visualHeight / 2).toBeLessThanOrEqual(room.maxY + 1e-6);
  });

  it("shrinks the stage when its stored size alone exceeds the room (width 1175 > room height ~988 after margin)", () => {
    const fitted = fitStageToRoom(stage1, "inches", room);
    expect(fitted.width).toBeLessThan(stage1.width);
    expect(fitted.depth).toBeLessThan(stage1.depth);
    // Aspect ratio preserved
    expect(fitted.width / fitted.depth).toBeCloseTo(stage1.width / stage1.depth, 5);
  });

  it("leaves a stage that already fits untouched in size, only clamping position if needed", () => {
    const smallStage = { x: 1855, y: 1570, width: 200, depth: 100, rotation: 0 };
    const fitted = fitStageToRoom(smallStage, "inches", room);
    expect(fitted.width).toBeCloseTo(200, 5);
    expect(fitted.depth).toBeCloseTo(100, 5);
  });

  it("does not clamp position when the stage already fits well within the room", () => {
    const centeredStage = { x: 1855, y: 1570, width: 200, depth: 100, rotation: 0 };
    const fitted = fitStageToRoom(centeredStage, "inches", room);
    const expectedCenter = stageVisualCenter(centeredStage, "inches");
    expect(fitted.x).toBeCloseTo(expectedCenter.x, 5);
    expect(fitted.y).toBeCloseTo(expectedCenter.y, 5);
  });
});
