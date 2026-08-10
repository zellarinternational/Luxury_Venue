import { EntityCard } from "@/design-system/components/EntityCard";
import { Badge } from "@/design-system/components/Badge";
import { formatCapacity, formatHallroomCount } from "./format";

export function HotelCard({
  countrySlug,
  citySlug,
  venueGroupId,
  venueGroupName,
  imageUrl,
  hallroomCount,
  hasLiveHallroom,
  capacityMax,
}: {
  countrySlug: string;
  citySlug: string;
  venueGroupId: string;
  venueGroupName: string;
  imageUrl?: string | null;
  hallroomCount: number;
  hasLiveHallroom: boolean;
  capacityMax: number;
}) {
  const capacity = formatCapacity(capacityMax, null);
  return (
    <EntityCard
      href={`/country/${countrySlug}/${citySlug}/hotel/${venueGroupId}`}
      imageUrl={imageUrl ?? undefined}
      imageAlt={venueGroupName}
      title={venueGroupName}
      meta={[formatHallroomCount(hallroomCount), capacity].filter(Boolean).join(" · ")}
      badge={
        !hasLiveHallroom ? <Badge variant="neutral">Coming soon</Badge> : undefined
      }
    />
  );
}
