"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useHallStore } from "./store";
import { getTableArrangementStats } from "./placement/tableCalculator";
import { cn } from "@/lib/cn";

const SEATING_MODES = [
  { value: "auto", label: "Auto mix" },
  { value: "tables-only", label: "Tables only" },
  { value: "chairs-only", label: "Chairs only" },
] as const;

export function HallControls() {
  const geometry = useHallStore((s) => s.geometry);
  const guestCount = useHallStore((s) => s.guestCount);
  const seatingModeOverride = useHallStore((s) => s.seatingModeOverride);
  const selectedStageId = useHallStore((s) => s.selectedStageId);
  const placedObjects = useHallStore((s) => s.placedObjects);
  const selectedTableAreaId = useHallStore((s) => s.selectedTableAreaId);
  const setGuestCount = useHallStore((s) => s.setGuestCount);
  const setSeatingMode = useHallStore((s) => s.setSeatingMode);
  const selectStage = useHallStore((s) => s.selectStage);

  if (!geometry) return null;

  const tableArea = geometry.tableAreas.find((ta) => ta.id === selectedTableAreaId);
  const activeMode = seatingModeOverride ?? tableArea?.seatingMode ?? "auto";
  const stats = getTableArrangementStats(placedObjects, tableArea);

  return (
    <aside className="w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-6 overflow-y-auto">
      <div>
        <label htmlFor="guest-count" className="text-sm font-medium text-[var(--color-foreground)] block mb-2">
          Guest count
        </label>
        <input
          id="guest-count"
          type="number"
          min={0}
          value={guestCount}
          onChange={(e) => setGuestCount(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-foreground)] focus-visible:outline-none"
        />
      </div>

      <div>
        <span className="text-sm font-medium text-[var(--color-foreground)] block mb-2">Seating mode</span>
        <Tabs.Root value={activeMode} onValueChange={(v) => setSeatingMode(v as typeof activeMode)}>
          <Tabs.List className="flex flex-col gap-1">
            {SEATING_MODES.map((mode) => (
              <Tabs.Trigger
                key={mode.value}
                value={mode.value}
                className={cn(
                  "text-left rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
                  "data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-neutral-0)]",
                  "data-[state=inactive]:text-[var(--color-text-muted)] data-[state=inactive]:hover:bg-[var(--color-surface-raised)]",
                )}
              >
                {mode.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </div>

      {geometry.stages.length > 0 ? (
        <div>
          <span className="text-sm font-medium text-[var(--color-foreground)] block mb-2">Stage</span>
          <div className="flex flex-col gap-1">
            {geometry.stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => selectStage(stage.id)}
                className={cn(
                  "text-left rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
                  stage.id === selectedStageId
                    ? "bg-[var(--color-accent)] text-[var(--color-neutral-0)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]",
                )}
              >
                {stage.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pt-4 border-t border-[var(--color-border)] space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Tables</span>
          <span className="text-[var(--color-foreground)]">{stats.tables}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Standalone chairs</span>
          <span className="text-[var(--color-foreground)]">{stats.singleChairs}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span className="text-[var(--color-foreground)]">Total seated</span>
          <span className="text-[var(--color-accent)]">{stats.totalGuests}</span>
        </div>
      </div>
    </aside>
  );
}
