import {
  areRectCornersInPolygon,
  getPolygonBounds,
  polygonToArray,
  type Bounds,
  type Point,
} from "./geometry";
import {
  getDoorAreaAtPosition,
  isObjectInAnyDoorArea,
  type DoorArea,
} from "./doorAreas";
import type {
  PlacedChair,
  PlacedObject,
  PlacedTable,
  TableArrangementResult,
  TableConfig,
} from "./types";

/** Padding around a table footprint to account for chairs tucked under the table DXF/GLB. */
const TABLE_FOOTPRINT_PADDING = 18;

interface CarpetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getAreaBoundsAndPolygon(tableConfig: TableConfig): {
  bounds: Bounds;
  polygon: Point[] | null;
} {
  if (tableConfig.namedPoints) {
    const polygon = polygonToArray(tableConfig.namedPoints);
    return { bounds: getPolygonBounds(polygon), polygon };
  }
  return {
    bounds: {
      minX: tableConfig.startX ?? 0,
      maxX: tableConfig.endX ?? 0,
      minY: tableConfig.startY ?? 0,
      maxY: tableConfig.endY ?? 0,
    },
    polygon: null,
  };
}

/** Shifts a candidate row's Y to clear carpet/aisle bands and previously placed objects in the same column. */
function adjustYForCarpetArea(
  centerY: number,
  objHeight: number,
  carpets: CarpetPosition[],
  previousYs: number[] = [],
  minSpacing = 0,
): number {
  let adjustedY = centerY;
  const objTop = adjustedY + objHeight / 2;
  const objBottom = adjustedY - objHeight / 2;

  for (const carpet of carpets) {
    const carpetTop = carpet.y + carpet.height / 2;
    const carpetBottom = carpet.y - carpet.height / 2;
    if (objTop >= carpetBottom && objBottom <= carpetTop) {
      adjustedY = carpetBottom - objHeight / 2;
      break;
    }
  }

  const spacing = minSpacing || objHeight;
  for (const prevY of previousYs) {
    const prevTop = prevY + objHeight / 2;
    const prevBottom = prevY - objHeight / 2;
    const newTop = adjustedY + objHeight / 2;
    const newBottom = adjustedY - objHeight / 2;
    if (newTop > prevBottom - spacing && newBottom < prevTop + spacing) {
      adjustedY = prevBottom - spacing - objHeight / 2;
    }
  }

  return adjustedY;
}

interface TableColumnCandidate {
  x: number;
  y: number;
  tableIndex: number;
}

/**
 * Fills table columns left-to-right, top-to-bottom within a column, stopping
 * at whichever comes first: `maxColumns` or `targetGuestCount` seats reached.
 * This single function replaces the legacy tableCalculator.ts's two
 * near-duplicate implementations (`placeTablesOnly` and
 * `placeTablesInColumns`), which differed only in their stop condition.
 *
 * Each candidate table's corners are validated against the actual seating
 * polygon (not just its bounding box) — the legacy live path never did this,
 * so a non-rectangular table area could place tables outside its true shape.
 */
function fillTableColumns(params: {
  tableConfig: TableConfig;
  doorAreas: DoorArea[];
  carpets: CarpetPosition[];
  maxColumns: number;
  targetGuestCount?: number;
}): { tables: TableColumnCandidate[]; actualGuests: number } {
  const { tableConfig, doorAreas, carpets, maxColumns, targetGuestCount } = params;
  const { bounds, polygon } = getAreaBoundsAndPolygon(tableConfig);

  const tableWidthWithSpacing = tableConfig.width + tableConfig.columnSpacing;
  const tableHeightWithSpacing = tableConfig.height + tableConfig.tableSpacing;
  const rowsPerGroup = tableConfig.rowsPerGroup ?? 999;
  const rowGroupSpacing = tableConfig.rowGroupSpacing ?? 0;
  const maxTablesPerColumn = Math.floor((bounds.maxY - bounds.minY) / tableHeightWithSpacing);

  const tables: TableColumnCandidate[] = [];
  let tableIndex = 0;
  let currentX = bounds.minX + tableConfig.width / 2 + TABLE_FOOTPRINT_PADDING;
  let columnsPlaced = 0;
  let currentGuests = 0;

  const guestLimitReached = () =>
    targetGuestCount !== undefined && currentGuests >= targetGuestCount;

  while (
    columnsPlaced < maxColumns &&
    !guestLimitReached() &&
    currentX + tableConfig.width / 2 + TABLE_FOOTPRINT_PADDING <= bounds.maxX
  ) {
    // Pre-scan the column for door overlaps: skip every row that actually
    // overlaps a door, not just the first/last row of an overlapping span.
    // (The legacy algorithm only skipped the span's boundary rows, which is
    // fine for a door a row or two tall but leaves every row in between
    // buildable for a door area that spans many rows — e.g. a full-height
    // emergency-exit clearance strip — putting tables right through it.)
    const skipRows = new Set<number>();

    for (let row = 0; row < maxTablesPerColumn; row++) {
      const extraRowGroupSpacing = Math.floor(row / rowsPerGroup) * rowGroupSpacing;
      let rowY =
        bounds.maxY - tableConfig.height / 2 - TABLE_FOOTPRINT_PADDING - row * tableHeightWithSpacing - extraRowGroupSpacing;
      rowY = adjustYForCarpetArea(rowY, tableConfig.height + TABLE_FOOTPRINT_PADDING * 2, carpets);
      if (rowY - tableConfig.height / 2 - TABLE_FOOTPRINT_PADDING < bounds.minY) break;

      const doorInfo = getDoorAreaAtPosition(
        {
          x: currentX,
          y: rowY,
          width: tableConfig.width + TABLE_FOOTPRINT_PADDING * 2,
          height: tableConfig.height + TABLE_FOOTPRINT_PADDING * 2,
        },
        doorAreas,
      );
      if (doorInfo) skipRows.add(row);
    }

    // Pass 2: place tables top-to-bottom, honoring skip rows, the polygon, and the guest-count stop condition.
    for (let row = 0; row < maxTablesPerColumn && !guestLimitReached(); row++) {
      if (skipRows.has(row)) continue;

      const extraRowGroupSpacing = Math.floor(row / rowsPerGroup) * rowGroupSpacing;
      let rowY =
        bounds.maxY - tableConfig.height / 2 - TABLE_FOOTPRINT_PADDING - row * tableHeightWithSpacing - extraRowGroupSpacing;
      rowY = adjustYForCarpetArea(rowY, tableConfig.height + TABLE_FOOTPRINT_PADDING * 2, carpets);

      if (rowY - tableConfig.height / 2 - TABLE_FOOTPRINT_PADDING < bounds.minY) continue;

      const withinPolygon =
        !polygon ||
        areRectCornersInPolygon(
          { x: currentX, y: rowY, width: tableConfig.width, height: tableConfig.height },
          polygon,
        );
      if (!withinPolygon) continue;

      tables.push({ x: currentX, y: rowY, tableIndex: tableIndex++ });
      currentGuests += tableConfig.chairsPerTable;
    }

    columnsPlaced++;
    currentX += tableWidthWithSpacing;
  }

  return { tables, actualGuests: tables.length * tableConfig.chairsPerTable };
}

interface ChairColumnCandidate {
  x: number;
  y: number;
  chairIndex: number;
}

/**
 * Column/row capacity math for the chair grid, shared by chairs-only and the
 * auto-mix overflow path. Note: `singleChair.chairsPerRow` (a per-column seat
 * cap) is intentionally not applied here — the legacy algorithm computed it
 * but never actually enforced it (chair columns always fill to whatever fits
 * the available width), so carrying that cap forward would change behavior
 * rather than preserve it. Tracked as a known gap, not silently dropped.
 */
function computeChairColumnCapacity(tableConfig: TableConfig, bounds: Bounds) {
  const chair = tableConfig.singleChair!;
  const chairWidthWithSpacing = chair.width + chair.spacing;
  const chairHeightWithSpacing = chair.height + chair.spacing;
  const availableHeight = bounds.maxY - bounds.minY;

  const chairRowsPerGroup = chair.rowsPerGroup || 999;
  const chairRowGroupSpacing = tableConfig.rowGroupSpacing || 0;
  const chairGroupBlockHeight = chairRowsPerGroup * chairHeightWithSpacing + chairRowGroupSpacing;
  const chairFullGroups = Math.floor(availableHeight / chairGroupBlockHeight);
  const chairRemainingHeight = availableHeight - chairFullGroups * chairGroupBlockHeight;
  const chairExtraRows = Math.floor(chairRemainingHeight / chairHeightWithSpacing);
  const maxChairsPerColumn = chairFullGroups * chairRowsPerGroup + chairExtraRows;

  return { chairWidthWithSpacing, chairHeightWithSpacing, maxChairsPerColumn };
}

/**
 * Fills chair columns left-to-right starting at `startX`, column-major
 * (fully fills one column before moving to the next), stopping at
 * `maxGuests`. Ported near-verbatim from tableCalculator.ts's
 * `placeChairsInColumns` with a polygon corner-containment check added.
 */
function placeChairsInColumns(params: {
  numColumns: number;
  maxGuests: number;
  tableConfig: TableConfig;
  doorAreas: DoorArea[];
  carpets: CarpetPosition[];
  bounds: Bounds;
  polygon: Point[] | null;
  maxChairsPerColumn: number;
  startX: number;
}): { chairs: ChairColumnCandidate[]; actualGuests: number } {
  const { numColumns, maxGuests, tableConfig, doorAreas, carpets, bounds, polygon, maxChairsPerColumn, startX } = params;
  const chairs: ChairColumnCandidate[] = [];
  if (!tableConfig.singleChair) return { chairs, actualGuests: 0 };

  const chair = tableConfig.singleChair;
  const chairWidthWithSpacing = chair.width + chair.spacing;
  const chairHeightWithSpacing = chair.height + chair.spacing;
  const chairRowsPerGroup = chair.rowsPerGroup || 999;
  const chairRowGroupSpacing = tableConfig.rowGroupSpacing || 0;
  let chairIndex = 0;

  // Pass 1: pre-scan columns for valid (in-polygon, door-clear) rows.
  const columnData: Array<{ x: number; validRows: number[] }> = [];
  let tempX = startX + chair.width / 2;
  let totalCapacitySoFar = 0;

  while (columnData.length < numColumns && tempX + chair.width / 2 <= bounds.maxX) {
    const validRowsInCol: number[] = [];
    // Skip every row that overlaps a door, plus a 1-row clearance buffer on
    // each side — same fix as the table path: skipping only a span's
    // boundary rows leaves the middle of a tall door area buildable.
    const skipRows = new Set<number>();
    const columnYs: number[] = [];

    for (let row = 0; row < maxChairsPerColumn; row++) {
      const extraRowGroupSpacing = Math.floor(row / chairRowsPerGroup) * chairRowGroupSpacing;
      let rowY = bounds.maxY - chair.height / 2 - row * chairHeightWithSpacing - extraRowGroupSpacing;
      rowY = adjustYForCarpetArea(rowY, chair.height, carpets, columnYs, chair.spacing);
      if (rowY - chair.height / 2 < bounds.minY - 0.1) continue;

      const withinPolygon =
        !polygon || areRectCornersInPolygon({ x: tempX, y: rowY, width: chair.width, height: chair.height }, polygon);
      if (!withinPolygon) continue;

      const chairRect = { x: tempX, y: rowY, width: chair.width, height: chair.height };
      if (isObjectInAnyDoorArea(chairRect, doorAreas)) {
        skipRows.add(row);
        if (row + 1 < maxChairsPerColumn) skipRows.add(row + 1);
        if (row - 1 >= 0) skipRows.add(row - 1);
      }

      validRowsInCol.push(row);
      columnYs.push(rowY);
    }

    const actualValidRows = validRowsInCol.filter((row) => !skipRows.has(row));
    if (actualValidRows.length > 0) {
      columnData.push({ x: tempX, validRows: actualValidRows });
      totalCapacitySoFar += actualValidRows.length;
    }

    tempX += chairWidthWithSpacing;
  }

  // Pass 2: column-major fill up to maxGuests.
  let remainingGuests = Math.min(maxGuests, totalCapacitySoFar);
  for (const col of columnData) {
    if (remainingGuests <= 0) break;
    const columnYs: number[] = [];
    const sortedRows = [...col.validRows].sort((a, b) => a - b);

    for (const row of sortedRows) {
      if (remainingGuests <= 0) break;
      const extraRowGroupSpacing = Math.floor(row / chairRowsPerGroup) * chairRowGroupSpacing;
      let rowY = bounds.maxY - chair.height / 2 - row * chairHeightWithSpacing - extraRowGroupSpacing;
      rowY = adjustYForCarpetArea(rowY, chair.height, carpets, columnYs, chair.spacing);

      chairs.push({ x: col.x, y: rowY, chairIndex: chairIndex++ });
      columnYs.push(rowY);
      remainingGuests--;
    }
  }

  return { chairs, actualGuests: chairs.length };
}

function placeTablesOnly(
  targetGuestCount: number,
  tableConfig: TableConfig,
  doorAreas: DoorArea[],
  carpets: CarpetPosition[],
): { tables: TableColumnCandidate[]; chairs: ChairColumnCandidate[]; actualGuests: number } {
  const { tables, actualGuests } = fillTableColumns({
    tableConfig,
    doorAreas,
    carpets,
    maxColumns: Infinity,
    targetGuestCount,
  });
  return { tables, chairs: [], actualGuests };
}

function placeChairsOnly(
  targetGuestCount: number,
  tableConfig: TableConfig,
  doorAreas: DoorArea[],
  carpets: CarpetPosition[],
): { tables: TableColumnCandidate[]; chairs: ChairColumnCandidate[]; actualGuests: number } {
  if (!tableConfig.singleChair) {
    return { tables: [], chairs: [], actualGuests: 0 };
  }

  const { bounds, polygon } = getAreaBoundsAndPolygon(tableConfig);
  const chair = tableConfig.singleChair;
  const { chairWidthWithSpacing, maxChairsPerColumn } = computeChairColumnCapacity(tableConfig, bounds);
  const availableWidth = bounds.maxX - (bounds.minX + chair.width / 2);
  const maxColumnsAvailable = Math.floor(availableWidth / chairWidthWithSpacing) + 1;

  if (maxColumnsAvailable <= 0) return { tables: [], chairs: [], actualGuests: 0 };

  const { chairs, actualGuests } = placeChairsInColumns({
    numColumns: maxColumnsAvailable,
    maxGuests: targetGuestCount,
    tableConfig,
    doorAreas,
    carpets,
    bounds,
    polygon,
    maxChairsPerColumn,
    startX: bounds.minX + chair.width / 2,
  });

  return { tables: [], chairs, actualGuests };
}

/**
 * "auto" mode: searches table-column counts from max down to 0, and for each,
 * fills the freed width with chair columns (if `singleChair` is configured),
 * keeping whichever combination lands closest to the guest target.
 */
function placeSmartMix(
  targetGuestCount: number,
  tableConfig: TableConfig,
  doorAreas: DoorArea[],
  carpets: CarpetPosition[],
): { tables: TableColumnCandidate[]; chairs: ChairColumnCandidate[]; actualGuests: number } {
  const { bounds, polygon } = getAreaBoundsAndPolygon(tableConfig);
  const tableWidthWithSpacing = tableConfig.width + tableConfig.columnSpacing;
  const maxColumnsAvailable = Math.floor((bounds.maxX - bounds.minX) / tableWidthWithSpacing);

  let chairWidthWithSpacing = 0;
  let maxChairsPerColumn = 0;
  if (tableConfig.singleChair) {
    ({ chairWidthWithSpacing, maxChairsPerColumn } = computeChairColumnCapacity(tableConfig, bounds));
  }

  let best = { tables: [] as TableColumnCandidate[], chairs: [] as ChairColumnCandidate[], actualGuests: 0, gap: Infinity };

  for (let tableColumns = maxColumnsAvailable; tableColumns >= 0; tableColumns--) {
    const tableResult = fillTableColumns({ tableConfig, doorAreas, carpets, maxColumns: tableColumns });
    const remainingGuests = targetGuestCount - tableResult.actualGuests;

    if (remainingGuests <= 0) {
      const gap = Math.abs(tableResult.actualGuests - targetGuestCount);
      if (gap < best.gap) {
        best = { tables: tableResult.tables, chairs: [], actualGuests: tableResult.actualGuests, gap };
      }
      continue;
    }

    if (!tableConfig.singleChair) continue;

    const rightmostTableX =
      tableResult.tables.length > 0 ? Math.max(...tableResult.tables.map((t) => t.x)) : null;
    const chairStartX =
      rightmostTableX !== null
        ? rightmostTableX +
          tableConfig.width / 2 +
          TABLE_FOOTPRINT_PADDING +
          tableConfig.singleChair.spacing / 2 +
          tableConfig.singleChair.width / 2
        : bounds.minX + tableConfig.singleChair.width / 2;

    const spaceForChairs = bounds.maxX - chairStartX;
    const chairColumnsToPlace = Math.floor(spaceForChairs / chairWidthWithSpacing);

    if (chairColumnsToPlace > 0) {
      const chairResult = placeChairsInColumns({
        numColumns: chairColumnsToPlace,
        maxGuests: remainingGuests,
        tableConfig,
        doorAreas,
        carpets,
        bounds,
        polygon,
        maxChairsPerColumn,
        startX: chairStartX,
      });

      const totalGuests = tableResult.actualGuests + chairResult.actualGuests;
      const gap = Math.abs(totalGuests - targetGuestCount);

      if (gap < best.gap || best.actualGuests < totalGuests) {
        best = { tables: tableResult.tables, chairs: chairResult.chairs, actualGuests: totalGuests, gap };
      }
      if (totalGuests >= targetGuestCount && gap <= tableConfig.chairsPerTable) break;
    } else if (tableResult.actualGuests > best.actualGuests) {
      best = {
        tables: tableResult.tables,
        chairs: [],
        actualGuests: tableResult.actualGuests,
        gap: Math.abs(tableResult.actualGuests - targetGuestCount),
      };
    }
  }

  if (best.actualGuests === 0 && maxColumnsAvailable > 0) {
    const fallback = fillTableColumns({ tableConfig, doorAreas, carpets, maxColumns: maxColumnsAvailable });
    best = {
      tables: fallback.tables,
      chairs: [],
      actualGuests: fallback.actualGuests,
      gap: Math.abs(fallback.actualGuests - targetGuestCount),
    };
  }

  return best;
}

type SeatingObjectForCarpets = { type: "table" | "chair" | "stage"; x: number; y: number; width?: number; height?: number; rotation?: number };

function getCentersFromArray<T>(arr: T[], count: number): T[] {
  const total = arr.length;
  const mid = Math.floor((total - 1) / 2);
  if (count === 1) return [arr[mid]];

  let left = mid;
  let right = mid;
  const result: T[] = [];
  while (result.length < count && (left >= 0 || right < total)) {
    if (left >= 0) {
      result.unshift(arr[left]);
      if (result.length >= count) break;
    }
    if (right + 1 < total) result.push(arr[right + 1]);
    left--;
    right++;
  }
  return result.slice(0, count);
}

/** Computes aisle/carpet gap rectangles between center row-pairs, used both for visual rendering and as an input to re-placement (aisles must not be built over). */
export function getCarpetPositions(
  objects: SeatingObjectForCarpets[],
  tableConfig: TableConfig,
): CarpetPosition[] {
  const numColumns = tableConfig.columns ?? 1;
  if (numColumns < 2) return [];

  const carpetsToShow = numColumns - 1;
  let tables = objects.filter((o) => o.type === "table");
  let isTables = true;
  if (tables.length === 0) {
    tables = objects.filter((o) => o.type === "chair");
    isTables = false;
  }
  if (tables.length === 0) return [];

  const stageObj = objects.find((o) => o.type === "stage");
  let stageRightEdge: number | null = null;
  if (stageObj) {
    const width = stageObj.width && stageObj.width > 0 ? stageObj.width : 1140;
    const height = stageObj.height && stageObj.height > 0 ? stageObj.height : 200;
    const rot = stageObj.rotation ?? 0;
    const edge = rot === 90 ? stageObj.x + height / 2 : stageObj.x + width / 2;
    stageRightEdge = Number.isFinite(edge) ? edge : null;
  }

  const { bounds } = getAreaBoundsAndPolygon(tableConfig);
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) || bounds.maxX <= bounds.minX) return [];

  const tablesByRow = new Map<number, SeatingObjectForCarpets[]>();
  for (const table of tables) {
    if (!Number.isFinite(table.y)) continue;
    if (!tablesByRow.has(table.y)) tablesByRow.set(table.y, []);
    tablesByRow.get(table.y)!.push(table);
  }
  const rowYs = Array.from(tablesByRow.keys()).sort((a, b) => b - a);
  if (rowYs.length < 2) return [];

  const tableHeight = tableConfig.height > 0 ? tableConfig.height : 72;
  const tableSpacing = Math.max(0, tableConfig.tableSpacing || 0);
  const rowGroupSpacing = Math.max(0, tableConfig.rowGroupSpacing || 0);
  const carpetHeight = Math.max(tableSpacing, rowGroupSpacing, 1);
  const centerRows = getCentersFromArray(rowYs, carpetsToShow);

  const carpetStartX = stageRightEdge ?? bounds.minX;
  const left = Math.min(carpetStartX, bounds.maxX);
  const right = Math.max(carpetStartX, bounds.maxX);
  const carpetWidth = right - left;
  const carpetX = (left + right) / 2;
  if (!Number.isFinite(carpetWidth) || carpetWidth <= 0) return [];

  const isValidGap = isTables
    ? rowYs.length === (tableConfig.rowsPerGroup ?? 0) * (tableConfig.columns ?? 0)
    : rowYs.length === (tableConfig.singleChair?.chairsPerRow ?? 0);
  if (!isValidGap) return [];

  const carpets: CarpetPosition[] = [];
  for (let i = 0; i < rowYs.length - 1; i++) {
    const topRowY = rowYs[i];
    const bottomRowY = rowYs[i + 1];
    const gap = Math.abs(topRowY - bottomRowY) - tableHeight;
    if (gap <= 0 || !centerRows.includes(topRowY)) continue;
    const cy = (topRowY + bottomRowY) / 2;
    if (!Number.isFinite(cy)) continue;
    carpets.push({ x: carpetX, y: cy, width: carpetWidth, height: carpetHeight });
  }
  return carpets;
}

/** Entry point: computes a full table/chair layout for a guest count + seating mode. */
export function calculateTableArrangement(
  guestCount: number,
  tableConfig: TableConfig,
  doorAreas: DoorArea[] = [],
): TableArrangementResult {
  if (guestCount === 0) {
    return {
      objects: [],
      arrangement: {
        tableConfigId: tableConfig.id,
        totalTables: 0,
        totalChairsAtTables: 0,
        totalSingleChairs: 0,
        totalGuests: 0,
      },
    };
  }

  const mode = tableConfig.seatingMode ?? "auto";
  const placeByMode = mode === "tables-only" ? placeTablesOnly : mode === "chairs-only" ? placeChairsOnly : placeSmartMix;

  // Two-pass: carpets depend on the placed layout, so place once, derive carpets, then re-place around them.
  let result = placeByMode(guestCount, tableConfig, doorAreas, []);
  const carpets = getCarpetPositions(
    [...result.tables.map((t) => ({ type: "table" as const, x: t.x, y: t.y })), ...result.chairs.map((c) => ({ type: "chair" as const, x: c.x, y: c.y }))],
    tableConfig,
  );
  if (carpets.length > 0) {
    result = placeByMode(guestCount, tableConfig, doorAreas, carpets);
  }

  const objects: PlacedObject[] = [];
  for (const table of result.tables) {
    const placed: PlacedTable = {
      id: crypto.randomUUID(),
      type: "table",
      x: table.x,
      y: table.y,
      tableIndex: table.tableIndex,
      width: tableConfig.width,
      height: tableConfig.height,
      rotation: 0,
      fileName: tableConfig.fileName,
      glbWidth: tableConfig.glbWidth,
      glbHeight: tableConfig.glbHeight,
      glbDepth: tableConfig.glbDepth,
    };
    objects.push(placed);
  }
  for (const chair of result.chairs) {
    if (!tableConfig.singleChair) continue;
    const placed: PlacedChair = {
      id: crypto.randomUUID(),
      type: "chair",
      x: chair.x,
      y: chair.y,
      chairIndex: chair.chairIndex,
      width: tableConfig.singleChair.width,
      height: tableConfig.singleChair.height,
      rotation: tableConfig.singleChair.rotation ?? 0,
      fileName: tableConfig.singleChair.fileName,
      glbWidth: tableConfig.singleChair.glbWidth,
      glbHeight: tableConfig.singleChair.glbHeight,
      glbDepth: tableConfig.singleChair.glbDepth,
    };
    objects.push(placed);
  }

  return {
    objects,
    arrangement: {
      tableConfigId: tableConfig.id,
      totalTables: result.tables.length,
      totalChairsAtTables: result.tables.length * tableConfig.chairsPerTable,
      totalSingleChairs: result.chairs.length,
      totalGuests: result.actualGuests,
    },
  };
}

export function getTableArrangementStats(
  objects: PlacedObject[],
  tableConfig?: TableConfig,
): { tables: number; chairsAtTables: number; singleChairs: number; totalGuests: number } {
  const tables = objects.filter((o) => o.type === "table").length;
  const singleChairs = objects.filter((o) => o.type === "chair").length;
  const chairsPerTable = tableConfig?.chairsPerTable ?? 8;
  const chairsAtTables = tables * chairsPerTable;
  return { tables, chairsAtTables, singleChairs, totalGuests: chairsAtTables + singleChairs };
}
