"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/schemas/clinical";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import { RecordingBar } from "@/components/recording/RecordingBar";
import { ManualNote } from "@/components/round/ManualNote";
import { IconMic, IconPencil } from "@/components/ui/icons";

export type RoundMode = "record" | "write";

/**
 * One round, two ways in.
 *
 * A doctor documents a round by talking or by writing, and which one suits
 * them changes with the patient, the room and the hour. So both live here
 * behind a single switch, and the switch is only a switch — it changes which
 * input is on screen and nothing else.
 *
 * Nothing is owned by a mode. The transcript, the typed note and the draft
 * record all live in the store, so moving between recording and writing
 * cannot lose work, and a round can legitimately be half spoken and half
 * typed. Both inputs feed the same extractor and merge into the same draft,
 * which dedupes — a heart rate stated in both places lands once.
 *
 * The recorder itself is untouched: RecordingBar is rendered as it was, with
 * its own lifecycle intact, under its own mode.
 */
export function RoundWorkspace({
  patient,
  onPhaseChange,
}: {
  patient: Patient;
  onPhaseChange?: (phase: string) => void;
}) {
  const [mode, setMode] = useState<RoundMode>("record");
  const { discardRound, approveRound } = useWard();

  const hasTranscript = Boolean(patient.lastTranscript?.trim());
  const hasNote = Boolean(patient.roundNote?.trim());
  const isDraft = patient.draftClinicalData !== null;

  // A round already carrying typed text opens on the writing side, so a
  // half-finished note is never hidden behind the recorder on return.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (hasNote && !hasTranscript) setMode("write");
  }, [hasNote, hasTranscript]);

  const discard = useCallback(() => discardRound(patient.id), [discardRound, patient.id]);
  const approve = useCallback(() => approveRound(patient.id), [approveRound, patient.id]);

  return (
    <div className="sticky bottom-0 z-30 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-ward">
        <ModeSwitch
          mode={mode}
          onChange={setMode}
          hasTranscript={hasTranscript}
          hasNote={hasNote}
        />
      </div>

      {/* Both modes stay mounted. Unmounting the recorder to show the note
          would tear down a live microphone session mid-round; unmounting the
          note would drop the caret and the scroll position. Only one is
          visible, and the hidden one is inert to the keyboard. */}
      <div className={mode === "record" ? "" : "hidden"} aria-hidden={mode !== "record"}>
        <RecordingBar patient={patient} onPhaseChange={onPhaseChange} embedded />
      </div>
      <div className={mode === "write" ? "" : "hidden"} aria-hidden={mode !== "write"}>
        <ManualNote
          patient={patient}
          isDraft={isDraft}
          onDiscard={discard}
          onApprove={approve}
        />
      </div>
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
  hasTranscript,
  hasNote,
}: {
  mode: RoundMode;
  onChange: (mode: RoundMode) => void;
  hasTranscript: boolean;
  hasNote: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="אופן תיעוד הסבב"
      className="mb-2 flex w-fit items-center gap-1 rounded-chip border border-line/60 bg-card/70 p-1 shadow-sm backdrop-blur-xl"
    >
      <ModeTab
        active={mode === "record"}
        filled={hasTranscript}
        onClick={() => onChange("record")}
        icon={<IconMic className="h-[17px] w-[17px]" />}
        label="הקלטה ותמלול"
      />
      <ModeTab
        active={mode === "write"}
        filled={hasNote}
        onClick={() => onChange("write")}
        icon={<IconPencil className="h-[17px] w-[17px]" />}
        label="כתיבה חופשית"
      />
    </div>
  );
}

function ModeTab({
  active,
  filled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  /** This side already holds content. Marked so switching away never feels
   *  like the other half was thrown out. */
  filled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-chip px-3.5 py-2 text-[13px] font-semibold transition-colors",
        active
          ? "bg-navy text-on-navy"
          : "text-ink-muted hover:bg-page-deep/70 hover:text-navy",
      )}
    >
      {icon}
      {label}
      {filled && (
        <span
          aria-label="יש תוכן"
          title="יש תוכן"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            active ? "bg-white/70" : "bg-stable",
          )}
        />
      )}
    </button>
  );
}
