import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface EntityCardProps {
  imageUrl?: string;
  imageAlt: string;
  title: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
  className?: string;
}

/**
 * Single presentational card primitive for anything "browsable" (venue, event
 * theme, hotel). Replaces the ~70%-duplicated markup previously split across
 * HotelCard/EventVenueCard — data-shape-specific concerns belong in a thin
 * adapter (e.g. VenueCard) that maps a domain object onto these props.
 */
export function EntityCard({
  imageUrl,
  imageAlt,
  title,
  meta,
  badge,
  footer,
  href,
  className,
}: EntityCardProps) {
  const content = (
    <div
      className={cn(
        "group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="relative aspect-[4/3] bg-[var(--color-surface-raised)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        {badge ? <div className="absolute top-3 left-3">{badge}</div> : null}
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-base font-medium text-[var(--color-foreground)] font-[family-name:var(--font-display)]">
          {title}
        </h3>
        {meta ? (
          <div className="text-sm text-[var(--color-text-muted)]">{meta}</div>
        ) : null}
        {footer ? <div className="pt-3">{footer}</div> : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
