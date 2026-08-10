import { EntityCard } from "@/design-system/components/EntityCard";
import { Badge } from "@/design-system/components/Badge";

export function CountryCard({
  slug,
  name,
  tagline,
  heroImageUrl,
  comingSoon,
}: {
  slug: string;
  name: string;
  tagline?: string | null;
  heroImageUrl?: string | null;
  comingSoon?: boolean;
}) {
  return (
    <EntityCard
      href={comingSoon ? undefined : `/country/${slug}`}
      imageUrl={heroImageUrl ?? undefined}
      imageAlt={name}
      title={name}
      meta={tagline}
      badge={comingSoon ? <Badge variant="neutral">Coming soon</Badge> : undefined}
    />
  );
}
