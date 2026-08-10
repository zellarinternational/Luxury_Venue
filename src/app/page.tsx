import { getServerCaller } from "@server/api/caller";
import { CountryCard } from "@/modules/catalog/CountryCard";
import { PageHero } from "@/design-system/components/PageHero";

// DB-backed content can change without a redeploy — revalidate instead of
// letting Next bake this in as a static page at build time.
export const revalidate = 60;

export default async function Home() {
  const caller = getServerCaller();
  const countries = await caller.countries.list();

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <PageHero
        eyebrow="Event Venue Studio"
        title="Discover premium venues, plan every detail"
        subtitle="Browse ballrooms and event spaces worldwide, then design your hall layout in 2D and 3D."
      />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-xl font-medium font-[family-name:var(--font-display)] mb-6">
          Countries
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {countries.map((country) => (
            <CountryCard
              key={country.id}
              slug={country.slug}
              name={country.name}
              tagline={country.tagline}
              heroImageUrl={country.heroImageUrl}
              comingSoon={country.comingSoon === 1}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
