import { create } from "zustand";
import { calculateTableArrangement } from "./placement/tableCalculator";
import type { DoorArea } from "./placement/doorAreas";
import type { PlacedObject, SeatingMode, TableConfig } from "./placement/types";
import type { FloorPlanGeometry, StageGeometry } from "./geometry-source/types";

interface HallState {
  geometry: FloorPlanGeometry | null;
  selectedTableAreaId: string | null;
  selectedStageId: string | null;
  guestCount: number;
  seatingModeOverride: SeatingMode | null;
  placedObjects: PlacedObject[];

  loadGeometry: (geometry: FloorPlanGeometry) => void;
  selectTableArea: (tableAreaId: string) => void;
  selectStage: (stageId: string | null) => void;
  setGuestCount: (count: number) => void;
  setSeatingMode: (mode: SeatingMode | null) => void;
  reset: () => void;

  selectedTableArea: () => TableConfig | null;
  selectedStage: () => StageGeometry | null;
}

function recompute(
  geometry: FloorPlanGeometry | null,
  tableAreaId: string | null,
  guestCount: number,
  modeOverride: SeatingMode | null,
): PlacedObject[] {
  if (!geometry || !tableAreaId) return [];
  const tableArea = geometry.tableAreas.find((ta) => ta.id === tableAreaId);
  if (!tableArea) return [];

  const config: TableConfig = modeOverride ? { ...tableArea, seatingMode: modeOverride } : tableArea;
  const doorAreas: DoorArea[] = geometry.doorAreas;
  return calculateTableArrangement(guestCount, config, doorAreas).objects;
}

/**
 * Hall planner client state. Scope note: this is the Phase 4a (2D-only)
 * shape — custom-area drawing, manual table/chair count overrides, and
 * walk-mode camera state from the legacy src/store/hallStore.ts are
 * deferred to Phase 4b alongside the 3D scene port, not silently dropped.
 */
export const useHallStore = create<HallState>((set, get) => ({
  geometry: null,
  selectedTableAreaId: null,
  selectedStageId: null,
  guestCount: 0,
  seatingModeOverride: null,
  placedObjects: [],

  loadGeometry: (geometry) =>
    set({
      geometry,
      selectedTableAreaId: geometry.tableAreas[0]?.id ?? null,
      selectedStageId: geometry.stages[0]?.id ?? null,
      placedObjects: recompute(geometry, geometry.tableAreas[0]?.id ?? null, get().guestCount, get().seatingModeOverride),
    }),

  selectTableArea: (tableAreaId) =>
    set((state) => ({
      selectedTableAreaId: tableAreaId,
      placedObjects: recompute(state.geometry, tableAreaId, state.guestCount, state.seatingModeOverride),
    })),

  selectStage: (stageId) => set({ selectedStageId: stageId }),

  setGuestCount: (count) =>
    set((state) => ({
      guestCount: count,
      placedObjects: recompute(state.geometry, state.selectedTableAreaId, count, state.seatingModeOverride),
    })),

  setSeatingMode: (mode) =>
    set((state) => ({
      seatingModeOverride: mode,
      placedObjects: recompute(state.geometry, state.selectedTableAreaId, state.guestCount, mode),
    })),

  reset: () =>
    set({
      geometry: null,
      selectedTableAreaId: null,
      selectedStageId: null,
      guestCount: 0,
      seatingModeOverride: null,
      placedObjects: [],
    }),

  selectedTableArea: () => {
    const state = get();
    return state.geometry?.tableAreas.find((ta) => ta.id === state.selectedTableAreaId) ?? null;
  },
  selectedStage: () => {
    const state = get();
    return state.geometry?.stages.find((s) => s.id === state.selectedStageId) ?? null;
  },
}));
