"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrefs } from "@/lib/store/prefs";
import { useWard } from "@/lib/store/ward-store";
import { WardAssistant } from "@/components/assistant/WardAssistant";
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
 * A thin translucent rail floating above every screen: the ward assistant on
 * one end, settings on the other.
 *
 * Deliberately quiet. It is chrome, and the ward is the content — so it sits at
 * 55% opacity over whatever is behind it and only firms up when a hand is near.
 */
export function UtilityBar() {
  const router = useRouter();
  const { theme, calmMotion, toggleTheme, setCalmMotion } = usePrefs();
  const { resetWard } = useWard();
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const night = theme === "dark";

  return (
    <>
      <div
        ref={barRef}
        className={cn(
          "fixed end-4 top-3.5 z-40 flex items-center gap-1.5 rounded-chip border border-line/60 bg-card/55 p-1.5 shadow-sm backdrop-blur-xl",
          "transition-colors duration-200 hover:bg-card/90",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setAssistantOpen(true);
            setMenuOpen(false);
          }}
          className="inline-flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-chip px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep/75 hover:text-ink"
        >
          <IconMessage className="h-[18px] w-[18px]" />
          עוזר המחלקה
        </button>

        <span className="h-5 w-px bg-line-strong" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="הגדרות"
          title="הגדרות"
          className={cn(
            "inline-flex h-[34px] w-[34px] items-center justify-center rounded-chip transition-colors",
            menuOpen
              ? "bg-navy text-on-navy"
              : "text-ink-muted hover:bg-page-deep/75 hover:text-ink",
          )}
        >
          <IconSettings className="h-[18px] w-[18px]" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute end-0 top-[calc(100%+8px)] w-[268px] overflow-hidden rounded-card border border-line bg-card/95 shadow-lift backdrop-blur-xl"
          >
            <div className="p-1.5">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold tracking-[0.04em] text-ink-decor">
                תצוגה
              </p>
              <MenuRow
                icon={night ? <IconMoon className="h-[18px] w-[18px]" /> : <IconSun className="h-[18px] w-[18px]" />}
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
                  setMenuOpen(false);
                  router.push("/rooms");
                }}
              />
              <MenuRow
                icon={<IconLogout className="h-[18px] w-[18px]" />}
                label="התנתקות"
                hint="חזרה למסך הפתיחה"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  setAssistantOpen(false);
                  router.push("/");
                }}
              />
            </div>
          </div>
        )}
      </div>

      {assistantOpen && <WardAssistant onClose={() => setAssistantOpen(false)} />}
    </>
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
