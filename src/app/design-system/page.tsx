import { Button } from "@/design-system/components/Button";
import { Badge } from "@/design-system/components/Badge";
import { EntityCard } from "@/design-system/components/EntityCard";
import { ApiRoundTrip } from "./ApiRoundTrip";

const neutralSteps = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const accentSteps = [50, 100, 300, 500, 700, 900];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium font-[family-name:var(--font-display)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Server component swatch grid — pure CSS var reads, no client state needed.
function Swatches() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">Neutral ramp</p>
        <div className="flex flex-wrap gap-2">
          {neutralSteps.map((step) => (
            <div key={step} className="text-center">
              <div
                className="h-12 w-12 rounded-[var(--radius-sm)] border border-[var(--color-border)]"
                style={{ background: `var(--color-neutral-${step})` }}
              />
              <span className="text-xs text-[var(--color-text-muted)]">{step}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">Accent ramp</p>
        <div className="flex flex-wrap gap-2">
          {accentSteps.map((step) => (
            <div key={step} className="text-center">
              <div
                className="h-12 w-12 rounded-[var(--radius-sm)] border border-[var(--color-border)]"
                style={{ background: `var(--color-accent-${step})` }}
              />
              <span className="text-xs text-[var(--color-text-muted)]">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)] p-8 space-y-12 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold font-[family-name:var(--font-display)]">
          Design System
        </h1>
        <p className="text-[var(--color-text-muted)]">
          Token and component sign-off surface — Phase 1 verification route.
        </p>
      </header>

      <Section title="Color tokens">
        <Swatches />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Entity card">
        <div className="max-w-sm">
          <EntityCard
            imageAlt="Sample venue"
            title="Infinity Ballroom"
            meta="Mumbai, India · Up to 600 guests"
            badge={<Badge variant="accent">Live</Badge>}
            footer={<Button size="sm">View venue</Button>}
          />
        </div>
      </Section>

      <Section title="tRPC round-trip check">
        <ApiRoundTrip />
      </Section>
    </main>
  );
}
