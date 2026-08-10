import { notFound } from "next/navigation";
import { getServerCaller } from "@server/api/caller";
import { HotelCard } from "@/modules/catalog/HotelCard";
import { PageHero } from "@/design-system/components/PageHero";
import { Breadcrumbs } from "@/design-system/components/Breadcrumbs";

export const revalidate = 60;

export default async function CityPage({
  params,
}: {
  params: Promise<{ countryId: string; cityId: string }>;
}) {
  const { countryId, cityId } = await params;
  const caller = getServerCaller();

  const [country, city] = await Promise.all([
    caller.countries.getBySlug({ slug: countryId }),
    caller.cities.getBySlug({ countrySlug: countryId, citySlug: cityId }),
  ]);
  if (!country || !city) notFound();

  const hotels = await caller.venues.listHotelsByCity({
    countrySlug: countryId,
    citySlug: cityId,
  });

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: country.name, href: `/country/${country.slug}` },
              { label: city.name },
            ]}
          />
        }
        eyebrow="City"
        title={city.heroTitle ?? city.name}
        subtitle={city.heroSubtitle ?? city.tagline ?? undefined}
        imageUrl={city.heroImageUrl}
      />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-xl font-medium font-[family-name:var(--font-display)] mb-6">
          Hotels &amp; venues
        </h2>
        {hotels.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">
            No venues listed in {city.name} yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.venueGroupId}
                countrySlug={country.slug}
                citySlug={city.slug}
                venueGroupId={hotel.venueGroupId}
                venueGroupName={hotel.venueGroupName}
                imageUrl={hotel.imageUrl}
                hallroomCount={hotel.hallroomCount}
                hasLiveHallroom={hotel.hasLiveHallroom}
                capacityMax={hotel.capacityMax}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
