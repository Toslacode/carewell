import type { ReactNode } from "react";
import Link from "next/link";
import { CarewellLockup } from "@/components/branding/CarewellLockup";
import { IconWheat } from "@/components/ui/icons";
import { BackLink } from "@/components/ui/primitives";

/**
 * The ward header from the reference screens, laid out for RTL: brand at the
 * start (right edge in Hebrew), ward title centred. The reference's
 * shield-and-cross badge is replaced by the actual CAREWELL mark — see
 * CarewellLockup for why.
 *
 * The end of the bar is left empty on purpose: the fixed utility rail floats
 * there, and the inline-end padding is the space it occupies.
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
      <div className="mx-auto flex max-w-ward items-center gap-4 rounded-panel border border-line/70 bg-card/80 px-4 py-3.5 shadow-sm backdrop-blur-xl sm:px-6 sm:pe-[216px]">
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
