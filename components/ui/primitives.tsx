import Link from "next/link";
import type { ReactNode } from "react";
import type { Descriptor, Tone } from "@/lib/labels";
import { cn } from "@/lib/utils/cn";
import { IconArrowBack } from "@/components/ui/icons";

/* ---------------------------------------------------------------- surfaces */

export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <As
      className={cn(
        "rounded-card border border-line bg-card shadow-card",
        className,
      )}
    >
      {children}
    </As>
  );
}

/* ------------------------------------------------------------------- pills */

const TONE_CLASS: Record<Tone, string> = {
  stable: "bg-stable-bg text-stable border-stable-line",
  attention: "bg-attention-bg text-attention border-attention-line",
  urgent: "bg-urgent-bg text-urgent border-urgent-line",
  info: "bg-info-bg text-info border-info-line",
  neutral: "bg-neutral-bg text-neutral border-neutral-line",
};

/**
 * Status is never communicated by color alone: every pill carries a glyph and
 * the written label, so it survives colorblindness, grayscale print and a
 * tablet screen in corridor glare.
 */
export function StatusPill({
  descriptor,
  className,
  size = "md",
}: {
  descriptor: Descriptor;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border font-medium",
        size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
        TONE_CLASS[descriptor.tone],
        className,
      )}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {descriptor.glyph}
      </span>
      {descriptor.label}
    </span>
  );
}

/** A small count badge, e.g. "3 משימות פתוחות" beside a panel title. */
export function CountBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "rounded-chip border px-2.5 py-1 text-[12px] font-medium",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- buttons */

export function Button({
  children,
  variant = "quiet",
  size = "md",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "quiet" | "ghost";
  size?: "sm" | "md" | "lg";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-chip font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "px-3.5 py-2 text-[13px]",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3.5 text-[15px]",
        variant === "primary" &&
          "bg-navy text-on-navy hover:bg-navy-deep active:bg-navy-deep",
        variant === "quiet" &&
          "border border-line-strong bg-card text-ink hover:bg-page-deep",
        variant === "ghost" && "text-ink-muted hover:bg-page-deep hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Icon-only control. Always needs a label — it becomes the accessible name. */
export function IconButton({
  label,
  children,
  className,
  ...props
}: {
  label: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        // 32px visual, 44px hit area via the negative-margin padding trick —
        // these are pressed on a tablet held in one hand.
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted",
        "transition-colors hover:bg-page-deep hover:text-ink",
        "focus-visible:bg-page-deep",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- navigation */

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-chip px-2 py-1 text-[15px] text-ink-muted transition-colors hover:text-navy"
    >
      <IconArrowBack className="h-[18px] w-[18px]" />
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong bg-card/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <span className="text-ink-decor">{icon}</span>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}

/** Section heading used inside the operational column and clinical record. */
export function PanelHeader({
  icon,
  title,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-navy-deep">
        {icon && <span className="text-navy-soft">{icon}</span>}
        {title}
      </h2>
      {trailing}
    </div>
  );
}
