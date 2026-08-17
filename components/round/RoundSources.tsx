"use client";

import { useState } from "react";
import type { Patient, RoundSource } from "@/lib/schemas/clinical";
import { cn } from "@/lib/utils/cn";
import { PanelHeader } from "@/components/ui/primitives";
import { IconChevronDown, IconDocument, IconMic, IconPencil } from "@/components/ui/icons";

/**
 * מקור הסבב — the round exactly as it went in.
 *
 * The structured record above this panel is an interpretation. This is the
 * evidence behind it, kept verbatim and never overwritten: what the microphone
 * heard and what the doctor typed, side by side and separately labelled,
 * because they are different kinds of claim and a reader needs to know which
 * one they are looking at.
 *
 * Past rounds stay too. A doctor questioning a decision three days later needs
 * the sentence that produced it, not a tidied summary of it.
 */
export function RoundSources({ patient }: { patient: Patient }) {
  const transcript = patient.lastTranscript?.trim() ?? "";
  const note = patient.roundNote?.trim() ?? "";
  const past = [...(patient.rounds ?? [])].reverse();
  const liveRound = Boolean(transcript || note);

  if (!liveRound && past.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconDocument className="h-[18px] w-[18px]" />}
        title="מקור הסבב"
      />

      {liveRound && (
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
          <p className="text-[12px] font-semibold text-info">הסבב הפתוח</p>
          {transcript && <SourceBlock kind="transcript" text={transcript} />}
          {note && <SourceBlock kind="note" text={note} />}
        </div>
      )}

      {past.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line">
          {past.map((round) => (
            <PastRound key={round.id} round={round} />
          ))}
        </ul>
      ) : (
        !liveRound && (
          <p className="px-5 py-5 text-[14px] text-ink-muted">
            טרם תועד סבב עבור מטופל זה.
          </p>
        )
      )}
    </section>
  );
}

function PastRound({ round }: { round: RoundSource }) {
  const [open, setOpen] = useState(false);
  const when = new Date(round.at).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-start transition-colors hover:bg-page-deep/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">סבב מאושר</span>
          <span className="tnum block text-[12px] text-ink-muted">{when}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-ink-muted">
          {round.transcript && (
            <span title="תמלול" aria-label="כולל תמלול">
              <IconMic className="h-4 w-4" />
            </span>
          )}
          {round.note && (
            <span title="הערות ידניות" aria-label="כולל הערות ידניות">
              <IconPencil className="h-4 w-4" />
            </span>
          )}
        </span>
        <IconChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-3.5">
          {round.transcript && <SourceBlock kind="transcript" text={round.transcript} />}
          {round.note && <SourceBlock kind="note" text={round.note} />}
        </div>
      )}
    </li>
  );
}

/** The two sources are never merged into one blob. Speech and writing carry
 *  different confidence — a transcription error and a typo are different
 *  problems — so the label stays attached to the text. */
function SourceBlock({ kind, text }: { kind: "transcript" | "note"; text: string }) {
  const spoken = kind === "transcript";
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
        {spoken ? (
          <IconMic className="h-[14px] w-[14px]" />
        ) : (
          <IconPencil className="h-[14px] w-[14px]" />
        )}
        {spoken ? "תמלול הסבב" : "הערות ידניות"}
      </p>
      <p
        className={cn(
          "whitespace-pre-wrap rounded-md border px-3 py-2 text-[13px] leading-relaxed text-ink",
          spoken
            ? "border-line bg-page-deep/45"
            : "border-navy-wash bg-navy-wash/45",
        )}
      >
        {text}
      </p>
    </div>
  );
}
