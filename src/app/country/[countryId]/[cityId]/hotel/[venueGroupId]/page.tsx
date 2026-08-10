import { notFound } from "next/navigation";
import { getServerCaller } from "@server/api/caller";
import { HallroomCard } from "@/modules/catalog/HallroomCard";
import { PageHero } from "@/design-system/components/PageHero";
import { Breadcrumbs } from "@/design-system/components/Breadcrumbs";

export const revalidate = 60;

export default async function HotelPage({
  params,
}: {
  params: Promise<{ countryId: string; cityId: string; venueGroupId: string }>;
}) {
  const { countryId, cityId, venueGroupId } = await params;
  const caller = getServerCaller();

  const [country, city] = await Promise.all([
    caller.countries.getBySlug({ slug: countryId }),
    caller.cities.getBySlug({ countrySlug: countryId, citySlug: cityId }),
  ]);
  if (!country || !city) notFound();

  const hallrooms = await caller.venues.listByHotelGroup({
    countrySlug: countryId,
    citySlug: cityId,
    venueGroupId,
  });
  if (hallrooms.length === 0) notFound();

  const hotelName = hallrooms[0].venueGroupName;

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: country.name, href: `/country/${country.slug}` },
              { label: city.name, href: `/country/${country.slug}/${city.slug}` },
              { label: hotelName },
            ]}
          />
        }
        eyebrow="Hotel"
        title={hotelName}
        subtitle={`${hallrooms.length} ballroom${hallrooms.length === 1 ? "" : "s"} available in ${city.name}`}
      />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-xl font-medium font-[family-name:var(--font-display)] mb-6">
          Ballrooms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {hallrooms.map((room) => (
            <HallroomCard
              key={room.id}
              name={room.name}
              description={room.description}
              status={room.status}
              thumbnailImageUrl={room.thumbnailImageUrl}
              capacitySeated={room.capacitySeated}
              capacityMax={room.capacityMax}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
