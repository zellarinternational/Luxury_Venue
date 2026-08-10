import { EntityCard } from "@/design-system/components/EntityCard";
import { Badge } from "@/design-system/components/Badge";
import { Button } from "@/design-system/components/Button";
import { formatCapacity } from "./format";

export function HallroomCard({
  name,
  description,
  status,
  thumbnailImageUrl,
  capacitySeated,
  capacityMax,
}: {
  name: string;
  description?: string | null;
  status: "live" | "coming_soon";
  thumbnailImageUrl?: string | null;
  capacitySeated?: number | null;
  capacityMax?: number | null;
}) {
  const capacity = formatCapacity(capacityMax, capacitySeated);
  return (
    <EntityCard
      imageUrl={thumbnailImageUrl ?? undefined}
      imageAlt={name}
      title={name}
      meta={
        <span className="space-y-1 block">
          {capacity ? <span className="block">{capacity}</span> : null}
          {description ? (
            <span className="block line-clamp-2">{description}</span>
          ) : null}
        </span>
      }
      badge={
        status === "live" ? (
          <Badge variant="accent">Live</Badge>
        ) : (
          <Badge variant="neutral">Coming soon</Badge>
        )
      }
      footer={
        <Button size="sm" variant="secondary" disabled>
          {status === "live" ? "Planner launching in Phase 4" : "Not yet available"}
        </Button>
      }
    />
  );
}
