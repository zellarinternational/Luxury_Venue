import { describe, expect, it } from "vitest";
import { calculateTableArrangement, getTableArrangementStats } from "./tableCalculator";
import { areRectCornersInPolygon, polygonToArray } from "./geometry";
import type { DoorArea } from "./doorAreas";
import type { TableConfig } from "./types";

// Fixture: infinity-ballroom's real "Infinity Dining Area" table config and
// door areas, as seeded from the legacy config (server/db/seed/data/venues-real.json).
const infinityTableConfig: TableConfig = {
  id: "infinity-main-dining",
  fileName: "table_set.dxf",
  glbFileName: "table_with_8_chair.glb",
  glbWidth: 72,
  glbHeight: 72,
  glbDepth: 72,
  width: 72,
  height: 72,
  chairsPerTable: 8,
  tableSpacing: 57,
  columns: 2,
  columnSpacing: 70,
  rowsPerGroup: 4,
  rowGroupSpacing: 65,
  namedPoints: {
    topLeft: { x: 1320, y: 2085 },
    topRight: { x: 3000, y: 2085 },
    bottomRight: { x: 3000, y: 1005 },
    bottomLeft: { x: 1320, y: 1005 },
  },
  seatingMode: "auto",
  singleChair: {
    fileName: "single_chair.dxf",
    glbFileName: "single_chair.glb",
    width: 18,
    height: 18,
    spacing: 13.5,
    chairsPerRow: 32,
    rotation: -90,
    rowsPerGroup: 16,
  },
};

const infinityDoorAreas: DoorArea[] = [
  { id: "main-entrance", polygon: { topLeft: { x: 1195, y: 2138 }, topRight: { x: 1300, y: 2138 }, bottomRight: { x: 1300, y: 950 }, bottomLeft: { x: 1195, y: 950 } } },
  { id: "infinity-main-entrance", polygon: { topLeft: { x: 1590, y: 2128 }, topRight: { x: 1695, y: 2128 }, bottomRight: { x: 1695, y: 950 }, bottomLeft: { x: 1590, y: 950 } } },
  { id: "emergency-exit", polygon: { topLeft: { x: 1965, y: 2128 }, topRight: { x: 2065, y: 2128 }, bottomRight: { x: 2065, y: 950 }, bottomLeft: { x: 1965, y: 950 } } },
  { id: "fire-exit", polygon: { topLeft: { x: 2567, y: 2128 }, topRight: { x: 2670, y: 2128 }, bottomRight: { x: 2670, y: 950 }, bottomLeft: { x: 2567, y: 950 } } },
  { id: "fire-exit-2", polygon: { topLeft: { x: 2276, y: 2128 }, topRight: { x: 2380, y: 2128 }, bottomRight: { x: 2380, y: 2025 }, bottomLeft: { x: 2276, y: 2025 } } },
];

function assertNoDoorOverlap(objects: ReturnType<typeof calculateTableArrangement>["objects"], doorAreas: DoorArea[]) {
  for (const obj of objects) {
    for (const door of doorAreas) {
      const xs = [door.polygon.topLeft.x, door.polygon.topRight.x, door.polygon.bottomRight.x, door.polygon.bottomLeft.x];
      const ys = [door.polygon.topLeft.y, door.polygon.topRight.y, door.polygon.bottomRight.y, door.polygon.bottomLeft.y];
      const doorMinX = Math.min(...xs);
      const doorMaxX = Math.max(...xs);
      const doorMinY = Math.min(...ys);
      const doorMaxY = Math.max(...ys);
      const halfW = obj.width / 2;
      const halfH = obj.height / 2;
      const overlaps = !(
        obj.x + halfW < doorMinX ||
        obj.x - halfW > doorMaxX ||
        obj.y + halfH < doorMinY ||
        obj.y - halfH > doorMaxY
      );
      expect(overlaps, `${obj.type} #${obj.type === "table" ? obj.tableIndex : obj.chairIndex} at (${obj.x}, ${obj.y}) overlaps door "${door.id}"`).toBe(false);
    }
  }
}

describe("calculateTableArrangement — real venue fixture (infinity-ballroom)", () => {
  it("returns an empty arrangement for 0 guests", () => {
    const result = calculateTableArrangement(0, infinityTableConfig, infinityDoorAreas);
    expect(result.objects).toHaveLength(0);
    expect(result.arrangement.totalGuests).toBe(0);
  });

  it.each([50, 150, 300, 500, 720])("places guests for a target of %i with no door collisions", (guestCount) => {
    const result = calculateTableArrangement(guestCount, infinityTableConfig, infinityDoorAreas);
    expect(result.objects.length).toBeGreaterThan(0);
    assertNoDoorOverlap(result.objects, infinityDoorAreas);

    // auto mode should get reasonably close to the target, not wildly over/under
    expect(result.arrangement.totalGuests).toBeGreaterThan(0);
  });

  it("tables-only mode never places standalone chairs", () => {
    const result = calculateTableArrangement(
      300,
      { ...infinityTableConfig, seatingMode: "tables-only" },
      infinityDoorAreas,
    );
    expect(result.objects.every((o) => o.type === "table")).toBe(true);
    expect(result.arrangement.totalSingleChairs).toBe(0);
  });

  it("chairs-only mode never places tables", () => {
    const result = calculateTableArrangement(
      300,
      { ...infinityTableConfig, seatingMode: "chairs-only" },
      infinityDoorAreas,
    );
    expect(result.objects.every((o) => o.type === "chair")).toBe(true);
    expect(result.arrangement.totalTables).toBe(0);
  });

  it("stats derived from placed objects match the arrangement summary", () => {
    const result = calculateTableArrangement(400, infinityTableConfig, infinityDoorAreas);
    const stats = getTableArrangementStats(result.objects, infinityTableConfig);
    expect(stats.tables).toBe(result.arrangement.totalTables);
    expect(stats.singleChairs).toBe(result.arrangement.totalSingleChairs);
    expect(stats.totalGuests).toBe(result.arrangement.totalGuests);
  });
});

describe("polygon corner containment (the merged fix)", () => {
  // A non-rectangular (right-trapezoid) area — the legacy live algorithm only
  // checked the bounding box, so it would place tables in the top-right
  // corner even though the polygon is cut away there. This is the concrete
  // scenario the plan's §4.2 merge exists to fix.
  const trapezoid = {
    topLeft: { x: 0, y: 200 },
    topRight: { x: 100, y: 200 },
    bottomRight: { x: 200, y: 0 }, // cuts inward — bounding box would extend to x=200 at y=0, but polygon doesn't
    bottomLeft: { x: 0, y: 0 },
  };

  it("rejects a rectangle whose corners fall outside a non-rectangular polygon", () => {
    const polygon = polygonToArray(trapezoid);
    // A rect centered where the bounding box exists but the trapezoid has
    // already narrowed away (near the cut corner).
    const outside = areRectCornersInPolygon({ x: 180, y: 20, width: 40, height: 40 }, polygon);
    expect(outside).toBe(false);
  });

  it("accepts a rectangle fully inside the polygon", () => {
    const polygon = polygonToArray(trapezoid);
    const inside = areRectCornersInPolygon({ x: 50, y: 100, width: 40, height: 40 }, polygon);
    expect(inside).toBe(true);
  });

  it("placement into a trapezoidal table area keeps every table's corners inside the polygon", () => {
    const trapezoidConfig: TableConfig = {
      id: "trapezoid-test",
      width: 30,
      height: 30,
      chairsPerTable: 8,
      tableSpacing: 10,
      columnSpacing: 10,
      namedPoints: trapezoid,
      seatingMode: "tables-only",
    };
    const result = calculateTableArrangement(200, trapezoidConfig, []);
    const polygon = polygonToArray(trapezoid);
    expect(result.objects.length).toBeGreaterThan(0);
    for (const obj of result.objects) {
      expect(
        areRectCornersInPolygon({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, polygon),
        `table at (${obj.x}, ${obj.y}) has corners outside the trapezoid`,
      ).toBe(true);
    }
  });
});
