"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClarioLockup, ClarioMark } from "@/components/branding/ClarioLockup";
import { WardAssistant } from "@/components/assistant/WardAssistant";
import { usePrefs } from "@/lib/store/prefs";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import {
  IconArrowBack,
  IconCheck,
  IconLogout,
  IconMessage,
  IconMoon,
  IconSettings,
  IconSun,
  IconWaveform,
} from "@/components/ui/icons";

/**
 * One bar, every screen.
 *
 * Three zones that never move: the mark at the start, where the ward is at the
 * centre, and the two chrome controls at the end. The bar is translucent and
 * sticky, so the record scrolls beneath it rather than being pushed down by it
 * — during a round the doctor's place on the page matters more than the
 * chrome, and the chrome should read as glass over the page.
 *
 * The centre is the part that earns its keep. Standing at a bedside you are
 * not "in the app", you are in room 3 — so the centre names the room, and on a
 * patient screen it becomes the room's bed strip: every patient in the room,
 * one tap apart. Walking to the next bed is a tap on the bar, not a trip back
 * out to the room list and in again.
 */
export function TopBar() {
  const pathname = usePathname();

  // The opening is a full-bleed film with its own way in. Chrome over it would
  // be an application frame around a title sequence.
  if (pathname === "/") return null;

  return <Bar pathname={pathname} />;
}

function Bar({ pathname }: { pathname: string }) {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-line/55 bg-card/72 backdrop-blur-xl",
          "supports-[backdrop-filter]:bg-card/62",
        )}
      >
        <div className="mx-auto flex h-[62px] max-w-ward items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <Link
            href="/rooms"
            aria-label="CLARIO — חזרה לבחירת חדר"
            className="shrink-0 rounded-card px-1 py-1 transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            {/* The full lockup where there is room for it; the mark alone on a
                phone, where the tagline would be four unreadable pixels. */}
            <ClarioLockup tagline={false} className="hidden sm:flex" />
            <ClarioMark className="h-8 w-8 text-navy sm:hidden" />
          </Link>

          <CentreZone pathname={pathname} />

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="inline-flex h-[36px] items-center gap-[7px] whitespace-nowrap rounded-chip px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep/75 hover:text-ink sm:px-3"
            >
              <IconMessage className="h-[18px] w-[18px]" />
              <span className="hidden lg:inline">עוזר המחלקה</span>
              <span className="sr-only lg:hidden">עוזר המחלקה</span>
            </button>
            <SettingsMenu />
          </div>
        </div>
      </header>

      {assistantOpen && <WardAssistant onClose={() => setAssistantOpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ centre */

function CentreZone({ pathname }: { pathname: string }) {
  const { rooms, getPatient, getRoom, roomPatients } = useWard();

  const patientId = pathname.startsWith("/patients/")
    ? pathname.split("/")[2]
    : null;
  const roomIdFromPath = pathname.startsWith("/rooms/")
    ? pathname.split("/")[2]
    : null;

  const patient = patientId ? getPatient(patientId) : undefined;
  const roomId = patient?.roomId ?? roomIdFromPath ?? null;
  const room = roomId ? getRoom(roomId) : undefined;
  const beds = roomId ? roomPatients(roomId) : [];

  // A patient screen gets the bed strip. Everything else gets a title, so the
  // bar's centre always answers "where am I" and never sits empty.
  if (patient && room) {
    return <BedStrip roomNumber={room.number} roomId={room.id} beds={beds} current={patient.id} />;
  }

  if (room) {
    return (
      <CentreTitle
        back={{ href: "/rooms", label: "כל החדרים" }}
        title={`חדר ${room.number}`}
        tnum
      />
    );
  }

  if (pathname === "/tasks") {
    return (
      <CentreTitle
        back={{ href: "/rooms", label: "כל החדרים" }}
        title="משימות המחלקה"
      />
    );
  }

  return (
    <CentreTitle
      title="מחלקה פנימית ב׳"
      subtitle={rooms.length > 0 ? "בחירת חדר" : undefined}
    />
  );
}

function CentreTitle({
  title,
  subtitle,
  back,
  tnum,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  tnum?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
      {back && (
        <Link
          href={back.href}
          className="hidden shrink-0 items-center gap-1.5 rounded-chip px-2 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-page-deep/70 hover:text-navy sm:inline-flex"
        >
          <IconArrowBack className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <p
        className={cn(
          "truncate text-[17px] font-bold tracking-tight text-navy-deep sm:text-[19px]",
          tnum && "tnum",
        )}
      >
        {title}
        {subtitle && (
          <span className="ms-2 align-middle text-[13px] font-medium text-ink-muted">
            {subtitle}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * The beds in this room, as one tap each.
 *
 * The current bed is filled navy rather than outlined, because in a strip of
 * near-identical chips "which one am I on" has to survive a glance from arm's
 * length. The strip scrolls horizontally when a room is fuller than the bar is
 * wide, and the active chip is scrolled into view on arrival so it is never
 * the one hidden past the edge.
 */
function BedStrip({
  roomNumber,
  roomId,
  beds,
  current,
}: {
  roomNumber: number;
  roomId: string;
  beds: Array<{ id: string; name: string; bed: number }>;
  current: string;
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
      <Link
        href={`/rooms/${roomId}`}
        aria-label={`חזרה לחדר ${roomNumber}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-chip border border-line-strong bg-card/70 px-2.5 py-1.5 text-[13px] font-semibold text-navy-deep transition-colors hover:bg-page-deep"
      >
        <IconArrowBack className="h-4 w-4 text-ink-muted" />
        חדר <span className="tnum">{roomNumber}</span>
      </Link>

      <nav
        aria-label="מטופלי החדר"
        className="no-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto"
      >
        {beds.map((p) => {
          const active = p.id === current;
          return (
            <Link
              key={p.id}
              ref={active ? activeRef : undefined}
              href={`/patients/${p.id}`}
              aria-current={active ? "page" : undefined}
              title={`מיטה ${p.bed} — ${p.name}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "border-navy bg-navy text-on-navy"
                  : "border-line-strong bg-card/70 text-ink-muted hover:bg-page-deep hover:text-navy",
              )}
            >
              <span
                className={cn(
                  "tnum rounded-full px-1.5 text-[11px] font-bold",
                  active ? "bg-white/20" : "bg-page-deep",
                )}
              >
                {p.bed}
              </span>
              {/* The name is the label on a wide bar; on a narrow one the bed
                  number alone identifies the chip and the name stays in the
                  tooltip and the accessible name. */}
              <span className="hidden max-w-[112px] truncate font-medium md:inline">
                {p.name}
              </span>
              <span className="sr-only md:hidden">{p.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------- settings */

function SettingsMenu() {
  const router = useRouter();
  const { theme, calmMotion, toggleTheme, setCalmMotion } = usePrefs();
  const { resetWard } = useWard();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const night = theme === "dark";

  return (
    <div ref={holder} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="הגדרות"
        title="הגדרות"
        className={cn(
          "inline-flex h-[36px] w-[36px] items-center justify-center rounded-chip transition-colors",
          open
            ? "bg-navy text-on-navy"
            : "text-ink-muted hover:bg-page-deep/75 hover:text-ink",
        )}
      >
        <IconSettings className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+10px)] w-[268px] overflow-hidden rounded-card border border-line bg-card/95 shadow-lift backdrop-blur-xl"
        >
          <div className="p-1.5">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-[0.04em] text-ink-decor">
              תצוגה
            </p>
            <MenuRow
              icon={
                night ? (
                  <IconMoon className="h-[18px] w-[18px]" />
                ) : (
                  <IconSun className="h-[18px] w-[18px]" />
                )
              }
              label="מצב לילה"
              hint={night ? "פעיל — רקע כהה לסבב לילה" : "כבוי — תצוגת יום"}
              checked={night}
              onClick={toggleTheme}
            />
            <MenuRow
              icon={<IconWaveform className="h-[18px] w-[18px]" />}
              label="הפחתת תנועה"
              hint={calmMotion ? "אנימציות מושבתות" : "אנימציות פעילות"}
              checked={calmMotion}
              onClick={() => setCalmMotion(!calmMotion)}
            />
          </div>

          <div className="border-t border-line p-1.5">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-[0.04em] text-ink-decor">
              חשבון
            </p>
            <MenuRow
              icon={<IconArrowBack className="h-[18px] w-[18px]" />}
              label="איפוס נתוני ההדגמה"
              hint="מחזיר את המחלקה למצב ההתחלתי"
              onClick={() => {
                resetWard();
                setOpen(false);
                router.push("/rooms");
              }}
            />
            <MenuRow
              icon={<IconLogout className="h-[18px] w-[18px]" />}
              label="התנתקות"
              hint="חזרה למסך הפתיחה"
              danger
              onClick={() => {
                setOpen(false);
                router.push("/");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  checked,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-start text-[14px] transition-colors",
        danger ? "text-urgent hover:bg-urgent-bg" : "text-ink hover:bg-page-deep",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        {label}
        <span className="mt-px block text-[12px] text-ink-muted">{hint}</span>
      </span>
      {checked !== undefined && <Switch on={checked} />}
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-chip transition-colors duration-200",
        on ? "bg-navy" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute start-[3px] top-[3px] h-4 w-4 rounded-chip bg-card-raised shadow-[0_1px_2px_rgba(0,0,0,.25)]",
          "transition-transform duration-200 ease-[cubic-bezier(.22,.61,.36,1)]",
          on && "-translate-x-4",
        )}
      />
      {on && <IconCheck className="sr-only" />}
    </span>
  );
}

/* ------------------------------------------------------------------ footer */

export function AppFooter() {
  return (
    <footer className="mx-auto flex max-w-ward flex-col items-center gap-2 px-6 pb-10 pt-8">
      <p className="text-[13px] text-ink-muted">כאן מתחילה ההחלמה</p>
      <p className="text-[11px] text-ink-decor">
        אב־טיפוס להדגמה · כל הנתונים בדיוניים
      </p>
    </footer>
  );
}
