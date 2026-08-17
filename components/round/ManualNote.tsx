"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/schemas/clinical";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import {
  ENGINE_LABEL,
  FALLBACK_MESSAGE,
  type ExtractionEngine,
  extract,
} from "@/lib/ai/extract";
import { Button, IconButton } from "@/components/ui/primitives";
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconMic,
  IconSparkle,
  IconTrash,
} from "@/components/ui/icons";

/**
 * Writing the round instead of speaking it.
 *
 * A blank page, deliberately: no category pickers, no field-by-field form.
 * The doctor writes the way they would write on paper — "משה בן 52 הגיע אתמול
 * למיון עם אשתו" — and the same extractor that reads a transcript reads this.
 * Asking a doctor to choose a category per sentence would be slower than the
 * paper it replaces.
 *
 * Structuring runs on an explicit press rather than as-you-type. Dictation
 * has a natural pause to trigger on; typing does not, and a record that
 * rearranged itself mid-sentence would be unusable.
 *
 * When a round also has a transcript, both are sent together, so a fact
 * mentioned in speech and again in writing is read once in context. The store
 * dedupes what comes back, so it lands in the record once.
 */
export function ManualNote({
  patient,
  isDraft,
  onDiscard,
  onApprove,
}: {
  patient: Patient;
  isDraft: boolean;
  onDiscard: () => void;
  onApprove: () => void;
}) {
  const { startRound, applyExtraction, setRoundNote } = useWard();

  const [text, setText] = useState(patient.roundNote ?? "");
  const [analysing, setAnalysing] = useState(false);
  const [engine, setEngine] = useState<ExtractionEngine | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [analysedAt, setAnalysedAt] = useState<number | null>(null);
  const [folded, setFolded] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The last value this editor pushed to the store, so its own echo can be
   *  told apart from a change that came from somewhere else. */
  const lastPushed = useRef(patient.roundNote ?? "");

  // The note survives navigation, so it is written through to the store as the
  // doctor types — debounced, because a keystroke is not a save point.
  useEffect(() => {
    if (text === lastPushed.current) return;
    const id = setTimeout(() => {
      lastPushed.current = text;
      setRoundNote(patient.id, text);
    }, 400);
    return () => clearTimeout(id);
  }, [text, patient.id, setRoundNote]);

  // Adopt a change that came from outside this editor. Approving or discarding
  // a round clears the note — including from the recorder, with this side of
  // the workspace off screen — and the editor must not then write the old text
  // back over the empty one.
  useEffect(() => {
    const stored = patient.roundNote ?? "";
    if (stored === lastPushed.current) return;
    lastPushed.current = stored;
    setText(stored);
    setAnalysedAt(null);
  }, [patient.roundNote]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const analyse = useCallback(async () => {
    const written = text.trim();
    if (!written || analysing) return;

    setAnalysing(true);
    setNote(null);
    setRoundNote(patient.id, written);
    startRound(patient.id);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Both halves of the round go in together. Reading them as one passage
    // gives the extractor the context it would have had if the whole round had
    // been spoken, and the store's merge drops anything already in the draft.
    //
    // Only when a round is actually open, though: a transcript left over from
    // the last approved round belongs to that round, and folding it into this
    // one would re-file old findings as new.
    const transcript = isDraft ? patient.lastTranscript?.trim() : undefined;
    const combined = [transcript, written].filter(Boolean).join("\n");

    try {
      const result = await extract(combined, controller.signal);
      applyExtraction(patient.id, result.extraction);
      setEngine(result.engine);
      setNote(result.fallbackReason ? FALLBACK_MESSAGE[result.fallbackReason] : null);
      setAnalysedAt(Date.now());
    } catch {
      // Superseded by a newer press, or aborted on unmount.
    } finally {
      setAnalysing(false);
    }
  }, [
    analysing,
    applyExtraction,
    isDraft,
    patient.id,
    patient.lastTranscript,
    setRoundNote,
    startRound,
    text,
  ]);

  const clear = useCallback(() => {
    setText("");
    setRoundNote(patient.id, "");
    setAnalysedAt(null);
    areaRef.current?.focus();
  }, [patient.id, setRoundNote]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const hasTranscript = Boolean(patient.lastTranscript?.trim());

  return (
    <section
      aria-label="כתיבת סבב"
      className={cn(
        "rounded-panel border bg-card/80 shadow-bar backdrop-blur-xl backdrop-saturate-150",
        "transition-[border-color,background-color] duration-500",
        "mx-auto max-w-ward hover:bg-card/95 focus-within:bg-card/95",
        analysing ? "border-info-line" : "border-line",
      )}
    >
      {note && (
        <p className="flex items-start gap-2 border-b border-line px-4 py-2.5 text-[13px] text-ink-muted sm:px-5">
          <IconSparkle className="mt-px h-4 w-4 shrink-0" />
          {note}
        </p>
      )}

      {folded ? (
        <div className="flex items-center gap-2.5 p-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-on-navy">
            <IconPencilGlyph />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-navy-deep">כתיבה חופשית</p>
            <p className="tnum text-[12px] text-ink-muted">
              {words === 0 ? "פתק ריק" : `${words} מילים`}
            </p>
          </div>
          {(isDraft || analysedAt) && (
            <Button variant="primary" size="sm" onClick={onApprove}>
              <IconCheck className="h-4 w-4" />
              אישור סבב
            </Button>
          )}
          <FoldButton folded onClick={() => setFolded(false)} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <textarea
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={
                "כתבו את הסבב כפי שהייתם כותבים על דף —\n" +
                "משה בן 52 הגיע אתמול למיון עם אשתו. יש לו דופק 60. נמצא לחץ דם 120/80."
              }
              className={cn(
                "min-h-[104px] w-full flex-1 resize-y rounded-card border border-line-strong bg-card-raised",
                "px-4 py-3 text-[15px] leading-relaxed text-ink outline-none transition-colors",
                "placeholder:text-ink-decor focus:border-navy",
              )}
            />
            <FoldButton folded={false} onClick={() => setFolded(true)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[12px] text-ink-muted">
              {hasTranscript ? (
                <>
                  <IconMic className="h-4 w-4 shrink-0" />
                  יש גם תמלול לסבב הזה — שניהם ינותחו יחד, ללא כפילויות.
                </>
              ) : (
                <>
                  <IconSparkle className="h-4 w-4 shrink-0" />
                  הכתוב יישמר כלשונו. הניתוח רק ממיין אותו לשדות.
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {text.trim() && !analysing && (
                <IconButton label="ניקוי הפתק" onClick={clear}>
                  <IconTrash className="h-[18px] w-[18px]" />
                </IconButton>
              )}

              {analysedAt && !analysing && (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-stable">
                  <IconCheck className="h-4 w-4" />
                  נותח
                  {engine && (
                    <span className="text-ink-muted">· {ENGINE_LABEL[engine]}</span>
                  )}
                </span>
              )}

              {analysing ? (
                <span className="flex items-center gap-2.5 text-[14px] font-medium text-info">
                  <IconSparkle className="h-[18px] w-[18px] rec-dot" />
                  ה־AI ממיין את המידע…
                  <span
                    aria-hidden="true"
                    className="scanning h-1 w-16 overflow-hidden rounded-full bg-info-bg"
                  />
                </span>
              ) : (
                <Button
                  variant={isDraft ? "quiet" : "primary"}
                  size="lg"
                  disabled={!text.trim()}
                  onClick={() => void analyse()}
                >
                  <IconSparkle className="h-[18px] w-[18px]" />
                  אישור וניתוח
                </Button>
              )}

              {(isDraft || analysedAt) && !analysing && (
                <>
                  <IconButton label="ביטול הטיוטה" onClick={onDiscard}>
                    <IconAlert className="h-[18px] w-[18px]" />
                  </IconButton>
                  <Button variant="primary" size="lg" onClick={onApprove}>
                    <IconCheck className="h-[18px] w-[18px]" />
                    אישור סבב
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!folded && isDraft && (
        <p className="flex items-center gap-2 border-t border-line bg-info-bg/40 px-4 py-2.5 text-[13px] text-info sm:px-5">
          <IconSparkle className="h-4 w-4 shrink-0" />
          טיוטת AI — יש לעבור על המידע לפני אישור.
        </p>
      )}
    </section>
  );
}

function IconPencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 20h4L19 9l-4-4L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FoldButton({ folded, onClick }: { folded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={folded ? "הרחבת הפתק" : "כיווץ הפתק"}
      title={folded ? "הרחבה" : "כיווץ"}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-chip border border-line-strong",
        "bg-card/60 text-ink-muted transition-colors hover:bg-page-deep hover:text-ink",
      )}
    >
      {folded ? (
        <IconChevronUp className="h-[18px] w-[18px]" />
      ) : (
        <IconChevronDown className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
