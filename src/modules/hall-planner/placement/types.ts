import type { Polygon4 } from "./geometry";
import type { DoorArea } from "./doorAreas";

export type SeatingMode = "auto" | "tables-only" | "chairs-only";

export interface SingleChairConfig {
  fileName?: string;
  glbFileName?: string;
  width: number;
  height: number;
  spacing: number;
  chairsPerRow?: number;
  rotation?: number;
  rowsPerGroup?: number;
  glbWidth?: number;
  glbHeight?: number;
  glbDepth?: number;
}

export interface TableConfig {
  id: string;
  fileName?: string;
  glbFileName?: string;
  chairFileName?: string;
  width: number;
  height: number;
  chairsPerTable: number;
  columnSpacing: number;
  tableSpacing: number;
  columns?: number;
  rowsPerGroup?: number;
  rowGroupSpacing?: number;
  namedPoints?: Polygon4;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  seatingMode?: SeatingMode;
  singleChair?: SingleChairConfig;
  glbWidth?: number;
  glbHeight?: number;
  glbDepth?: number;
}

export type { DoorArea };

export interface PlacedTable {
  id: string;
  type: "table";
  x: number;
  y: number;
  tableIndex: number;
  width: number;
  height: number;
  rotation: number;
  fileName?: string;
  glbWidth?: number;
  glbHeight?: number;
  glbDepth?: number;
}

export interface PlacedChair {
  id: string;
  type: "chair";
  x: number;
  y: number;
  chairIndex: number;
  width: number;
  height: number;
  rotation: number;
  fileName?: string;
  glbWidth?: number;
  glbHeight?: number;
  glbDepth?: number;
}

export type PlacedObject = PlacedTable | PlacedChair;

export interface TableArrangementResult {
  objects: PlacedObject[];
  arrangement: {
    tableConfigId: string;
    totalTables: number;
    /** Chairs baked into table-set models (tables * chairsPerTable), not standalone chair objects. */
    totalChairsAtTables: number;
    totalSingleChairs: number;
    totalGuests: number;
  };
}
