import { create } from "zustand";
import { calculateTableArrangement } from "./placement/tableCalculator";
import { getPolygonBounds, polygonToArray, type Point, type Polygon4 } from "./placement/geometry";
import type { DoorArea } from "./placement/doorAreas";
import type { PlacedObject, SeatingMode, TableConfig } from "./placement/types";
import type { FloorPlanGeometry, StageGeometry } from "./geometry-source/types";

export type ViewMode = "2d" | "orbit" | "walk";

/** Sentinel selectedTableAreaId used while a custom-drawn area is active. */
const CUSTOM_AREA_ID = "__custom__";

interface HallState {
  geometry: FloorPlanGeometry | null;
  selectedTableAreaId: string | null;
  selectedStageId: string | null;
  guestCount: number;
  seatingModeOverride: SeatingMode | null;
  placedObjects: PlacedObject[];
  viewMode: ViewMode;

  /**
   * DXF-units-per-3D-unit. Comes from `geometry.scaleFactor` (DB) when set;
   * otherwise computed once at runtime from the floor GLB's footprint (see
   * scene/gl-resources and scene/Hall3DScene's FloorPlanGLBModel) and cached
   * here — the single source every 3D consumer reads, so it can't drift out
   * of sync the way the legacy app's hardcoded 47.5 constant did.
   */
  scaleFactor: number | null;
  setScaleFactor: (factor: number) => void;

  isSelectingCustomArea: boolean;
  customAreaPoints: Point[];
  customTableArea: TableConfig | null;
  startCustomAreaSelection: () => void;
  addCustomAreaPoint: (point: Point) => void;
  clearCustomAreaSelection: () => void;

  loadGeometry: (geometry: FloorPlanGeometry) => void;
  selectTableArea: (tableAreaId: string) => void;
  selectStage: (stageId: string | null) => void;
  setGuestCount: (count: number) => void;
  setSeatingMode: (mode: SeatingMode | null) => void;
  setViewMode: (mode: ViewMode) => void;
  reset: () => void;

  /**
   * Applies a shared-config snapshot (from sharedConfigs.getByShortCode) on
   * top of already-loaded geometry — used by the /share/[shortCode] page and
   * by the originating /hall page when a remote edit arrives via polling.
   * Assumes `loadGeometry` has already run for the snapshot's floorPlanId.
   */
  applySharedState: (snapshot: {
    guestCount: number;
    seatingMode: SeatingMode | null;
    selectedTableAreaId: string | null;
    customTableArea: TableConfig | null;
    selectedStageId: string | null;
  }) => void;

  selectedTableArea: () => TableConfig | null;
  selectedStage: () => StageGeometry | null;
  /**
   * DXF-unit bounds center, used as the 3D scene's coordinate-transform
   * origin. Computed once in `loadGeometry` and stored as a plain field
   * (not a selector method like `selectedTableArea`/`selectedStage` above)
   * — a selector that builds a fresh `{x, y}` object literal on every call
   * never satisfies Zustand's reference-equality check, which caused an
   * infinite render loop the moment anything read it via
   * `useHallStore((s) => s.sceneCenter())`.
   */
  sceneCenter: Point | null;
}

function centerOf(bounds: Polygon4): Point {
  const b = getPolygonBounds(polygonToArray(bounds));
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

function resolveTableArea(
  geometry: FloorPlanGeometry | null,
  tableAreaId: string | null,
  customTableArea: TableConfig | null,
): TableConfig | null {
  if (tableAreaId === CUSTOM_AREA_ID) return customTableArea;
  return geometry?.tableAreas.find((ta) => ta.id === tableAreaId) ?? null;
}

function recompute(
  geometry: FloorPlanGeometry | null,
  tableAreaId: string | null,
  customTableArea: TableConfig | null,
  guestCount: number,
  modeOverride: SeatingMode | null,
): PlacedObject[] {
  const tableArea = resolveTableArea(geometry, tableAreaId, customTableArea);
  if (!geometry || !tableArea) return [];

  const config: TableConfig = modeOverride ? { ...tableArea, seatingMode: modeOverride } : tableArea;
  const doorAreas: DoorArea[] = geometry.doorAreas;
  return calculateTableArrangement(guestCount, config, doorAreas).objects;
}

/**
 * Hall planner client state.
 *
 * Scope note (Phase 4b): "manual table/chair count overrides" from the
 * legacy src/store/hallStore.ts were deliberately not ported — grepping the
 * legacy app found no UI ever called `setManualTableCount`/
 * `setManualChairCount`; it was dead state that only echoed back into the
 * shared-config JSON shape. Custom-area drawing and 3D view-mode/scale-factor
 * state (the two Phase 4b items that *were* real, used features) are below.
 */
export const useHallStore = create<HallState>((set, get) => ({
  geometry: null,
  selectedTableAreaId: null,
  selectedStageId: null,
  guestCount: 0,
  seatingModeOverride: null,
  placedObjects: [],
  viewMode: "2d",
  scaleFactor: null,
  sceneCenter: null,

  isSelectingCustomArea: false,
  customAreaPoints: [],
  customTableArea: null,

  loadGeometry: (geometry) =>
    set({
      geometry,
      selectedTableAreaId: geometry.tableAreas[0]?.id ?? null,
      selectedStageId: geometry.stages[0]?.id ?? null,
      scaleFactor: geometry.scaleFactor ?? null,
      sceneCenter: geometry.bounds ? centerOf(geometry.bounds) : null,
      customTableArea: null,
      isSelectingCustomArea: false,
      customAreaPoints: [],
      placedObjects: recompute(geometry, geometry.tableAreas[0]?.id ?? null, null, get().guestCount, get().seatingModeOverride),
    }),

  selectTableArea: (tableAreaId) =>
    set((state) => ({
      selectedTableAreaId: tableAreaId,
      customTableArea: tableAreaId === CUSTOM_AREA_ID ? state.customTableArea : null,
      placedObjects: recompute(state.geometry, tableAreaId, state.customTableArea, state.guestCount, state.seatingModeOverride),
    })),

  selectStage: (stageId) => set({ selectedStageId: stageId }),

  setGuestCount: (count) =>
    set((state) => ({
      guestCount: count,
      placedObjects: recompute(state.geometry, state.selectedTableAreaId, state.customTableArea, count, state.seatingModeOverride),
    })),

  setSeatingMode: (mode) =>
    set((state) => ({
      seatingModeOverride: mode,
      placedObjects: recompute(state.geometry, state.selectedTableAreaId, state.customTableArea, state.guestCount, mode),
    })),

  setViewMode: (mode) => set({ viewMode: mode }),

  setScaleFactor: (factor) =>
    set((state) => (state.scaleFactor == null ? { scaleFactor: factor } : {})),

  startCustomAreaSelection: () =>
    set({
      isSelectingCustomArea: true,
      customAreaPoints: [],
      customTableArea: null,
    }),

  addCustomAreaPoint: (point) =>
    set((state) => {
      const points = [...state.customAreaPoints, point];
      if (points.length < 4) return { customAreaPoints: points };

      const bounds = getPolygonBounds(points);
      const customArea: TableConfig = {
        id: CUSTOM_AREA_ID,
        width: 72,
        height: 72,
        chairsPerTable: 8,
        columnSpacing: 3,
        tableSpacing: 2,
        columns: 2,
        startX: bounds.minX,
        startY: bounds.minY,
        endX: bounds.maxX,
        endY: bounds.maxY,
        namedPoints: {
          topLeft: points[0],
          topRight: points[1],
          bottomRight: points[2],
          bottomLeft: points[3],
        },
      };

      return {
        customAreaPoints: points,
        isSelectingCustomArea: false,
        customTableArea: customArea,
        selectedTableAreaId: CUSTOM_AREA_ID,
        placedObjects: recompute(state.geometry, CUSTOM_AREA_ID, customArea, state.guestCount, state.seatingModeOverride),
      };
    }),

  clearCustomAreaSelection: () =>
    set((state) => {
      const fallbackId = state.geometry?.tableAreas[0]?.id ?? null;
      return {
        isSelectingCustomArea: false,
        customAreaPoints: [],
        customTableArea: null,
        selectedTableAreaId: fallbackId,
        placedObjects: recompute(state.geometry, fallbackId, null, state.guestCount, state.seatingModeOverride),
      };
    }),

  applySharedState: (snapshot) =>
    set((state) => {
      const tableAreaId = snapshot.customTableArea ? CUSTOM_AREA_ID : snapshot.selectedTableAreaId;
      return {
        guestCount: snapshot.guestCount,
        seatingModeOverride: snapshot.seatingMode,
        selectedTableAreaId: tableAreaId,
        customTableArea: snapshot.customTableArea,
        selectedStageId: snapshot.selectedStageId,
        isSelectingCustomArea: false,
        customAreaPoints: [],
        placedObjects: recompute(state.geometry, tableAreaId, snapshot.customTableArea, snapshot.guestCount, snapshot.seatingMode),
      };
    }),

  reset: () =>
    set({
      geometry: null,
      selectedTableAreaId: null,
      selectedStageId: null,
      guestCount: 0,
      seatingModeOverride: null,
      placedObjects: [],
      viewMode: "2d",
      scaleFactor: null,
      sceneCenter: null,
      isSelectingCustomArea: false,
      customAreaPoints: [],
      customTableArea: null,
    }),

  selectedTableArea: () => {
    const state = get();
    return resolveTableArea(state.geometry, state.selectedTableAreaId, state.customTableArea);
  },
  selectedStage: () => {
    const state = get();
    return state.geometry?.stages.find((s) => s.id === state.selectedStageId) ?? null;
  },
}));
