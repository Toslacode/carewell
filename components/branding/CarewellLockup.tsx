import { cn } from "@/lib/utils/cn";

/**
 * The CAREWELL mark: an open book, a pencil, and two connected hands beneath.
 * No heart, no medical cross, no gold — the reference screens' shield-and-cross
 * badge is not this brand's mark and is deliberately not reproduced.
 *
 * The full branding artwork is used as-is on the opening screen. This vector is
 * the responsive reduction for the 32px header lockup, where the artwork's
 * embossed relief and cream ground cannot survive.
 */
export function CarewellMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="CAREWELL"
      fill="none"
    >
      {/* open book — two leaves meeting at the spine */}
      <path
        d="M24 15.4c-2.6-2.1-6-3.2-9.6-3.2-1 0-1.7.7-1.7 1.6v12.5c0 .9.8 1.6 1.7 1.6 3.6 0 7 1 9.6 3.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M24 15.4c2.6-2.1 6-3.2 9.6-3.2 1 0 1.7.7 1.7 1.6v12.5c0 .9-.8 1.6-1.7 1.6-3.6 0-7 1-9.6 3.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M24 15.4V31" stroke="currentColor" strokeWidth="1.6" />

      {/* pencil, angled across the right leaf */}
      <path
        d="m31.4 10.6 3.6 3.6-8.1 8.1-4.4.8.8-4.4z"
        fill="var(--navy)"
        stroke="var(--navy)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="m22.5 22.3 2.2-.4-1.8-1.8z" fill="var(--ink)" />

      {/* two hands cupped beneath the book */}
      <path
        d="M20.5 33.6c-1.6-1.5-3.4-2.6-5.6-3.1-1.4-.3-2.5.4-2.7 1.6-.2 1.1.4 2 1.5 2.5 2.5 1.1 4.5 2.5 6.1 4.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.5 33.6c1.6-1.5 3.4-2.6 5.6-3.1 1.4-.3 2.5.4 2.7 1.6.2 1.1-.4 2-1.5 2.5-2.5 1.1-4.5 2.5-6.1 4.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The wordmark.
 *
 * On the full-scale artwork CARE is white with an embossed edge, which reads
 * beautifully at hero size on cream and disappears completely at 15px. The
 * reduction keeps the identity's two-tone split — a lighter first half, deep
 * navy second half — at a weight that survives on a warm ground. This is the
 * one place the identity is adapted, and only because legibility requires it.
 */
export function CarewellWordmark({
  className,
  onNavy = false,
}: {
  className?: string;
  onNavy?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-semibold tracking-[0.14em] leading-none whitespace-nowrap",
        className,
      )}
    >
      <span className={onNavy ? "text-white/70" : "text-navy-soft"}>CARE</span>
      <span className={onNavy ? "text-white" : "text-navy-deep"}>WELL</span>
    </span>
  );
}

export function CarewellLockup({
  tagline = true,
  className,
}: {
  tagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <CarewellMark className="h-9 w-9 shrink-0 text-navy" />
      <span className="flex flex-col gap-0.5">
        <CarewellWordmark className="text-[15px]" />
        {tagline && (
          <span className="text-[11px] leading-none text-ink-muted">
            טיפול אנושי. כל יום.
          </span>
        )}
      </span>
    </div>
  );
}
