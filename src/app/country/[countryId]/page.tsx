import { notFound } from "next/navigation";
import { getServerCaller } from "@server/api/caller";
import { CityCard } from "@/modules/catalog/CityCard";
import { PageHero } from "@/design-system/components/PageHero";
import { Breadcrumbs } from "@/design-system/components/Breadcrumbs";

export const revalidate = 60;

export default async function CountryPage({
  params,
}: {
  params: Promise<{ countryId: string }>;
}) {
  const { countryId } = await params;
  const caller = getServerCaller();
  const country = await caller.countries.getBySlug({ slug: countryId });
  if (!country) notFound();

  const cities = country.comingSoon
    ? []
    : await caller.cities.listByCountry({ countrySlug: countryId });

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <PageHero
        breadcrumbs={
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: country.name }]} />
        }
        eyebrow="Country"
        title={country.name}
        subtitle={country.heroSubtitle ?? country.tagline ?? undefined}
        imageUrl={country.heroImageUrl}
      />
      <section className="mx-auto max-w-6xl px-6 py-12">
        {country.comingSoon ? (
          <p className="text-[var(--color-text-muted)]">
            Venues in {country.name} are coming soon.
          </p>
        ) : (
          <>
            <h2 className="text-xl font-medium font-[family-name:var(--font-display)] mb-6">
              Cities
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cities.map((city) => (
                <CityCard
                  key={city.id}
                  countrySlug={country.slug}
                  slug={city.slug}
                  name={city.name}
                  tagline={city.tagline}
                  heroImageUrl={city.heroImageUrl}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
