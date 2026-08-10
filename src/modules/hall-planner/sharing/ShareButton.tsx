"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useHallStore } from "../store";
import { useSharedConfigPublish } from "./useSharedConfigSync";
import { Button } from "@/design-system/components/Button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/design-system/components/Dialog";

/**
 * Creates a shared_configs row for the current layout and keeps it synced
 * as the planner keeps editing (see useSharedConfigPublish). Once created,
 * the shortCode/version live in this component's own state — refreshing the
 * page loses the "live" link (same as the legacy app; a returning user
 * would create a fresh share), which is an acceptable simplification here.
 */
export function ShareButton({ venueId }: { venueId: string }) {
  const geometry = useHallStore((s) => s.geometry);
  const guestCount = useHallStore((s) => s.guestCount);
  const seatingModeOverride = useHallStore((s) => s.seatingModeOverride);
  const selectedTableAreaId = useHallStore((s) => s.selectedTableAreaId);
  const customTableArea = useHallStore((s) => s.customTableArea);
  const selectedStageId = useHallStore((s) => s.selectedStageId);

  const [shortCode, setShortCode] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const createMutation = trpc.sharedConfigs.create.useMutation({
    onSuccess: (row) => {
      setShortCode(row.shortCode);
      setVersion(row.version);
      setOpen(true);
    },
  });

  const { conflict } = useSharedConfigPublish({ shortCode, venueId, initialVersion: version });

  if (!geometry) return null;

  const shareUrl = shortCode && typeof window !== "undefined" ? `${window.location.origin}/share/${shortCode}` : "";

  const handleShare = () => {
    if (shortCode) {
      setOpen(true);
      return;
    }
    createMutation.mutate({
      venueId,
      floorPlanId: geometry.floorPlanId,
      guestCount,
      seatingMode: seatingModeOverride,
      selectedTableAreaId: selectedTableAreaId === "__custom__" ? null : selectedTableAreaId,
      customTableArea: customTableArea as Record<string, unknown> | null,
      selectedStageId,
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" onClick={handleShare} disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating link…" : shortCode ? "Share link" : "Share"}
      </Button>
      <DialogContent>
        <DialogTitle>Share this layout</DialogTitle>
        <DialogDescription>
          Anyone with this link can view the current guest count, seating arrangement, and stage — and their own
          adjustments will sync back here.
        </DialogDescription>
        {conflict ? (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-raised)] px-3 py-2 text-xs text-[var(--color-accent)]">
            This share was updated elsewhere just now — your latest change may not have saved. Try again.
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-foreground)] focus-visible:outline-none"
          />
          <Button size="sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="sm" className="mt-4 w-full">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
