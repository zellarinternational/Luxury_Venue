import { describe, expect, it } from "vitest";
import { calculateScaleFactor, dxfToWorld, worldToDxf } from "./coordinateTransform";

// Real cornerPoints extents from server/db/seed/data/venues-real.json.
const infinityBallroom = {
  center: { x: 1855, y: 1570 }, // (710+3000)/2, (1055+2085)/2
  scaleFactor: 50,
};

const grandHyattBallroom = {
  center: { x: -743.5, y: 1879.5 }, // (-1560+73)/2, (1400+2359)/2
  scaleFactor: 50,
};

describe("dxfToWorld", () => {
  it("maps the transform's own center to the world origin", () => {
    const a = dxfToWorld(infinityBallroom.center, infinityBallroom);
    expect(a.x).toBeCloseTo(0, 10);
    expect(a.z).toBeCloseTo(0, 10);
    const b = dxfToWorld(grandHyattBallroom.center, grandHyattBallroom);
    expect(b.x).toBeCloseTo(0, 10);
    expect(b.z).toBeCloseTo(0, 10);
  });

  it("divides by scaleFactor and flips the Y axis into world Z", () => {
    const point = { x: 3000, y: 2085 }; // infinity ballroom's topRight corner
    const result = dxfToWorld(point, infinityBallroom);
    expect(result.x).toBeCloseTo((3000 - 1855) / 50, 10);
    expect(result.z).toBeCloseTo(-(2085 - 1570) / 50, 10);
  });

  it("is the exact inverse of worldToDxf for arbitrary points", () => {
    const dxfPoints = [
      { x: 710, y: 1055 },
      { x: 3000, y: 2085 },
      { x: -1560, y: 1400 },
      { x: 73, y: 2359 },
    ];
    for (const p of dxfPoints) {
      for (const transform of [infinityBallroom, grandHyattBallroom]) {
        const world = dxfToWorld(p, transform);
        const roundTripped = worldToDxf(world, transform);
        expect(roundTripped.x).toBeCloseTo(p.x, 8);
        expect(roundTripped.y).toBeCloseTo(p.y, 8);
      }
    }
  });
});

describe("worldToDxf", () => {
  it("maps world origin back to the transform's center", () => {
    const p = worldToDxf({ x: 0, z: 0 }, infinityBallroom);
    expect(p.x).toBeCloseTo(infinityBallroom.center.x, 10);
    expect(p.y).toBeCloseTo(infinityBallroom.center.y, 10);
  });
});

describe("calculateScaleFactor", () => {
  it("picks the larger of the two axis ratios, so the model never overflows the DXF bounds on either axis", () => {
    // A GLB footprint narrower on X than Z relative to the DXF bounds.
    const scale = calculateScaleFactor(
      { width: 45.8, depth: 20.6 }, // 3D units
      { width: 2290, height: 1030 }, // DXF units (infinity ballroom extents)
    );
    // scaleFactorX = 2290/45.8 = 50, scaleFactorZ = 1030/20.6 = 50
    expect(scale).toBeCloseTo(50, 5);
  });

  it("uses max() so a non-square aspect-ratio mismatch still fully contains the footprint", () => {
    const scale = calculateScaleFactor({ width: 10, depth: 10 }, { width: 1000, height: 400 });
    // scaleFactorX = 100, scaleFactorZ = 40 -> max = 100
    expect(scale).toBe(100);
  });
});
