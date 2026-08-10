import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  breadcrumbs,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  breadcrumbs?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative overflow-hidden border-b border-[var(--color-border)]",
        className,
      )}
    >
      {imageUrl ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-30"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, var(--color-background) 100%)",
            }}
          />
        </div>
      ) : null}
      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
        {breadcrumbs ? <div className="mb-6">{breadcrumbs}</div> : null}
        {eyebrow ? (
          <p className="text-sm font-medium tracking-wide text-[var(--color-accent)] uppercase mb-3">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight font-[family-name:var(--font-display)] text-[var(--color-foreground)] max-w-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 text-lg text-[var(--color-text-muted)] max-w-xl">
            {subtitle}
          </p>
        ) : null}
      </div>
    </header>
  );
}
