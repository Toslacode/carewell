import type { ReactNode } from "react";
import Link from "next/link";
import { CarewellLockup } from "@/components/branding/CarewellLockup";
import { IconChevronDown, IconUser, IconWheat } from "@/components/ui/icons";
import { BackLink } from "@/components/ui/primitives";

/**
 * The ward header from the reference screens, laid out for RTL: brand at the
 * start (right edge in Hebrew), ward title centred, staff control at the end.
 * The reference's shield-and-cross badge is replaced by the actual CAREWELL
 * mark — see CarewellLockup for why.
 */
export function AppHeader({
  back,
  children,
}: {
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex max-w-ward items-center gap-4 rounded-panel border border-line bg-card px-4 py-3.5 shadow-sm sm:px-6">
        <Link
          href="/rooms"
          className="shrink-0 rounded-card transition-opacity hover:opacity-80"
        >
          <CarewellLockup />
          <span className="sr-only">חזרה לבחירת חדר</span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
          <p className="truncate text-xl font-bold tracking-tight text-navy-deep sm:text-2xl">
            מחלקה פנימית ב׳
          </p>
          {back ? <BackLink href={back.href}>{back.label}</BackLink> : children}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-chip border border-line-strong px-3.5 py-2 text-sm font-medium text-ink sm:inline-flex">
            <IconUser className="h-[18px] w-[18px] text-ink-muted" />
            צוות
            <IconChevronDown className="h-4 w-4 text-ink-muted" />
          </span>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mx-auto flex max-w-ward flex-col items-center gap-2 px-6 pb-10 pt-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink-decor">
        <IconWheat className="h-5 w-5" />
      </span>
      <p className="text-[13px] text-ink-muted">כאן מתחילה ההחלמה</p>
      <p className="text-[11px] text-ink-decor">
        אב־טיפוס להדגמה · כל הנתונים בדיוניים
      </p>
    </footer>
  );
}
