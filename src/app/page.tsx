import Link from "next/link";
import { Button } from "@/design-system/components/Button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--color-background)] text-[var(--color-foreground)] p-8 text-center">
      <h1 className="text-2xl font-semibold font-[family-name:var(--font-display)]">
        Event Venue Studio
      </h1>
      <p className="text-[var(--color-text-muted)] max-w-md">
        Phase 1 foundations are in place. The marketing/catalog experience
        (Phase 3 of the rewrite plan) lands here next.
      </p>
      <Link href="/design-system">
        <Button variant="secondary">View design system</Button>
      </Link>
    </main>
  );
}
