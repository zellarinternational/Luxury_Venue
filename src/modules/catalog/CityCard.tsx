import { EntityCard } from "@/design-system/components/EntityCard";

export function CityCard({
  countrySlug,
  slug,
  name,
  tagline,
  heroImageUrl,
}: {
  countrySlug: string;
  slug: string;
  name: string;
  tagline?: string | null;
  heroImageUrl?: string | null;
}) {
  return (
    <EntityCard
      href={`/country/${countrySlug}/${slug}`}
      imageUrl={heroImageUrl ?? undefined}
      imageAlt={name}
      title={name}
      meta={tagline}
    />
  );
}
