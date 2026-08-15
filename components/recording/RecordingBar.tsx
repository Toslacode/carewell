"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/schemas/clinical";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import {
  DEFAULT_ENGINE,
  type EngineId,
  type EngineOption,
  type TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionStatus,
  createProvider,
  listEngines,
} from "@/lib/transcription";
import {
  ENGINE_LABEL,
  FALLBACK_MESSAGE,
  type ExtractionEngine,
  extract,
} from "@/lib/ai/extract";
import { Waveform } from "@/components/recording/Waveform";
import { Button, IconButton } from "@/components/ui/primitives";
import {
  IconAlert,
  IconCheck,
  IconChevronDown,
  IconMic,
  IconPause,
  IconSparkle,
  IconStop,
  IconTrash,
} from "@/components/ui/icons";

/**
 * The round recorder.
 *
 * Sticky to the bottom of the patient page so it stays reachable while the
 * doctor scrolls the record. It carries the whole round in one strip:
 *
 *   התחל סבב → הקלטה → תמלול בזמן אמת → AI ממיין → סקירת טיוטה → עריכה → אישור סבב
 *
 * Two rules shape everything here. Nothing it produces enters the record
 * before אישור סבב. And it never claims to be transcribing when it isn't —
 * every failure mode has its own visible state rather than a silent stall.
 */

/** How long after speech settles before the transcript is sent for structuring.
 *  Long enough not to fire mid-sentence, short enough that the doctor sees the
 *  record fill in while they're still at the bedside. */
const EXTRACT_DEBOUNCE_MS = 2200;

type Phase =
  | "idle"
  | "preparing"
  | "ready"
  | "recording"
  | "paused"
  | "structuring"
  | "review"
  | "failed";

export function RecordingBar({
  patient,
  onPhaseChange,
}: {
  patient: Patient;
  /** Lets the page mirror the recorder's state — the clinical record shows a
   *  scan sweep while the AI is rewriting it. */
  onPhaseChange?: (phase: Phase) => void;
}) {
  const { startRound, applyExtraction, approveRound, discardRound, setTranscript } =
    useWard();

  const [phase, setPhase] = useState<Phase>(
    patient.draftClinicalData ? "review" : "idle",
  );
  const [engineId, setEngineId] = useState<EngineId>(DEFAULT_ENGINE);
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [error, setError] = useState<TranscriptionError | null>(null);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [aiEngine, setAiEngine] = useState<ExtractionEngine | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const providerRef = useRef<TranscriptionProvider | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const finalRef = useRef("");

  const isDraft = patient.draftClinicalData !== null;

  useEffect(() => setEngines(listEngines()), []);

  useEffect(() => onPhaseChange?.(phase), [phase, onPhaseChange]);

  // Timer
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const runExtraction = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const result = await extract(transcript, controller.signal);
        applyExtraction(patient.id, result.extraction);
        setAiEngine(result.engine);
        setAiNote(
          result.fallbackReason ? FALLBACK_MESSAGE[result.fallbackReason] : null,
        );
      } catch {
        // Aborted by a newer transcript — the newer run owns the result.
      }
    },
    [applyExtraction, patient.id],
  );

  const scheduleExtraction = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runExtraction(finalRef.current);
    }, EXTRACT_DEBOUNCE_MS);
  }, [runExtraction]);

  const teardown = useCallback(() => {
    providerRef.current?.dispose();
    providerRef.current = null;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  useEffect(() => teardown, [teardown]);

  const beginRound = useCallback(async () => {
    setError(null);
    setAiNote(null);
    setSeconds(0);
    setFinalText("");
    setPartialText("");
    finalRef.current = "";
    setPhase("preparing");
    startRound(patient.id);

    const provider = createProvider(engineId);
    providerRef.current = provider;

    await provider.prepare({
      onStatus: (status: TranscriptionStatus, progress?: number) => {
        if (status === "loading") {
          setPhase("preparing");
          setModelProgress(progress ?? null);
        }
        if (status === "ready") setModelProgress(null);
        if (status === "recording") setPhase("recording");
        if (status === "paused") setPhase("paused");
        if (status === "error") setPhase("failed");
      },
      onError: (err) => {
        setError(err);
        // A dropped audio window is a warning, not the end of the round —
        // only unrecoverable states take the bar out of recording.
        if (err.code !== "no-audio" && err.code !== "model-failed") {
          setPhase("failed");
        }
      },
      onLevel: setLevel,
      onPartial: setPartialText,
      onFinal: (text) => {
        setPartialText("");
        // One line per settled utterance. A speech engine's utterance boundary
        // is the only sentence boundary dictated Hebrew reliably gives us, and
        // the extractor splits on it; joining with a space instead would hand
        // the extractor one run-on sentence per round. It reads identically —
        // the transcript is rendered in a paragraph, where the newline
        // collapses back to a space.
        finalRef.current = `${finalRef.current}\n${text}`.trim();
        setFinalText(finalRef.current);
        setTranscript(patient.id, finalRef.current);
        scheduleExtraction();
      },
    });

    if (providerRef.current !== provider) return; // superseded
    if (!provider.isSupported()) return;

    await provider.start();
  }, [engineId, patient.id, scheduleExtraction, setTranscript, startRound]);

  const stopRound = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPhase("structuring");
    await providerRef.current?.stop();
    providerRef.current?.dispose();
    providerRef.current = null;
    await runExtraction(finalRef.current);
    setPhase("review");
  }, [runExtraction]);

  const cancelRound = useCallback(() => {
    teardown();
    discardRound(patient.id);
    setPhase("idle");
    setFinalText("");
    setPartialText("");
    finalRef.current = "";
    setSeconds(0);
    setAiEngine(null);
    setAiNote(null);
    setError(null);
  }, [discardRound, patient.id, teardown]);

  const confirmRound = useCallback(() => {
    teardown();
    approveRound(patient.id);
    setPhase("idle");
    setFinalText("");
    setPartialText("");
    finalRef.current = "";
    setSeconds(0);
    setAiEngine(null);
    setAiNote(null);
  }, [approveRound, patient.id, teardown]);

  const transcript = [finalText, partialText].filter(Boolean).join(" ");

  return (
    <div className="sticky bottom-0 z-30 px-4 pb-4 sm:px-6">
      <section
        aria-label="הקלטת סבב"
        className={cn(
          "mx-auto max-w-ward rounded-panel border bg-card/95 shadow-bar backdrop-blur-sm",
          "transition-[border-color,transform] duration-500",
          phase === "recording"
            ? "-translate-y-0.5 border-urgent-line"
            : phase === "structuring"
              ? "border-info-line"
              : "border-line",
        )}
      >
        {(error || aiNote) && (
          <div className="flex flex-col gap-1.5 border-b border-line px-4 py-2.5 sm:px-5">
            {error && (
              <p
                role="alert"
                className={cn(
                  "flex items-start gap-2 text-[13px]",
                  error.code === "no-audio" ? "text-attention" : "text-urgent",
                )}
              >
                <IconAlert className="mt-px h-4 w-4 shrink-0" />
                <span>{error.message}</span>
                {error.retryable && phase === "failed" && (
                  <button
                    type="button"
                    onClick={() => void beginRound()}
                    className="ms-1 shrink-0 font-semibold underline underline-offset-2"
                  >
                    נסו שוב
                  </button>
                )}
              </p>
            )}
            {aiNote && (
              <p className="flex items-start gap-2 text-[13px] text-ink-muted">
                <IconSparkle className="mt-px h-4 w-4 shrink-0" />
                {aiNote}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          {/* mic + state */}
          <div className="flex shrink-0 items-center gap-3">
            <MicButton
              phase={phase}
              onClick={() => {
                if (phase === "idle" || phase === "failed") void beginRound();
                else if (phase === "recording") {
                  providerRef.current?.pause();
                } else if (phase === "paused") {
                  providerRef.current?.resume();
                }
              }}
            />
            <div className="min-w-[132px]">
              <p className="text-[14px] font-semibold text-navy-deep">
                {stateLabel(phase, modelProgress)}
              </p>
              <p className="tnum text-[12px] text-ink-muted">
                {phase === "idle"
                  ? engineLabelFor(engines, engineId)
                  : formatClock(seconds)}
              </p>
            </div>
          </div>

          {/* waveform */}
          <div className="h-11 min-w-0 flex-1 rounded-md bg-page-deep/50 px-2">
            <Waveform level={level} active={phase === "recording"} />
          </div>

          {/* transcript */}
          <div className="min-w-0 flex-[1.4]">
            <p
              className={cn(
                "line-clamp-2 text-[14px] leading-relaxed text-ink transition-colors duration-300",
                phase === "recording" && "text-navy-deep",
              )}
              aria-live="polite"
            >
              {transcript || (
                <span className="text-ink-muted">
                  {phase === "idle"
                    ? "לחצו כדי להתחיל סבב מוקלט"
                    : "ממתין לדיבור…"}
                </span>
              )}
              {partialText && (
                <span key={partialText} className="reveal shown text-ink-muted">
                  {" "}
                  {partialText}
                </span>
              )}
            </p>
          </div>

          {/* controls */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {phase === "idle" && (
              <>
                <EnginePicker
                  engines={engines}
                  value={engineId}
                  open={pickerOpen}
                  onToggle={() => setPickerOpen((v) => !v)}
                  onSelect={(id) => {
                    setEngineId(id);
                    setPickerOpen(false);
                  }}
                />
                <Button variant="primary" size="lg" onClick={() => void beginRound()}>
                  <IconMic className="h-[18px] w-[18px]" />
                  התחל סבב
                </Button>
              </>
            )}

            {(phase === "recording" || phase === "paused") && (
              <>
                <Button
                  onClick={() =>
                    phase === "recording"
                      ? providerRef.current?.pause()
                      : providerRef.current?.resume()
                  }
                >
                  <IconPause className="h-[18px] w-[18px]" />
                  {phase === "recording" ? "השהיה" : "המשך"}
                </Button>
                <Button onClick={() => void stopRound()}>
                  <IconStop className="h-[18px] w-[18px]" />
                  סיום
                </Button>
              </>
            )}

            {phase === "structuring" && (
              <span className="flex items-center gap-2.5 text-[14px] font-medium text-info">
                <IconSparkle className="h-[18px] w-[18px] rec-dot" />
                ה־AI ממיין את המידע…
                <span
                  aria-hidden="true"
                  className="scanning h-1 w-16 overflow-hidden rounded-full bg-info-bg"
                />
              </span>
            )}

            {(phase === "review" || (isDraft && phase === "idle")) && (
              <>
                <IconButton label="ביטול הטיוטה" onClick={cancelRound}>
                  <IconTrash className="h-[18px] w-[18px]" />
                </IconButton>
                <Button onClick={() => void beginRound()}>
                  <IconMic className="h-[18px] w-[18px]" />
                  המשך הקלטה
                </Button>
                <Button variant="primary" size="lg" onClick={confirmRound}>
                  <IconCheck className="h-[18px] w-[18px]" />
                  אישור סבב
                </Button>
              </>
            )}
          </div>
        </div>

        {(phase === "review" || isDraft) && (
          <p className="flex items-center gap-2 border-t border-line bg-info-bg/40 px-4 py-2.5 text-[13px] text-info sm:px-5">
            <IconSparkle className="h-4 w-4 shrink-0" />
            טיוטת AI — יש לעבור על המידע לפני אישור.
            {aiEngine && (
              <span className="text-ink-muted">· {ENGINE_LABEL[aiEngine]}</span>
            )}
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function MicButton({ phase, onClick }: { phase: Phase; onClick: () => void }) {
  const recording = phase === "recording";
  const label =
    phase === "recording"
      ? "השהיית ההקלטה"
      : phase === "paused"
        ? "המשך ההקלטה"
        : "התחלת סבב מוקלט";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={phase === "preparing" || phase === "structuring"}
      className={cn(
        "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        recording
          ? "bg-urgent text-white"
          : phase === "paused"
            ? "bg-attention text-white"
            : "bg-navy text-on-navy hover:bg-navy-deep",
      )}
    >
      <IconMic className="h-6 w-6" />
      {recording && (
        <>
          {/* Two rings leaving the button on an offset cycle — the clearest
              at-a-glance signal that the microphone is genuinely live. */}
          <span
            aria-hidden="true"
            className="ring-1 pointer-events-none absolute inset-0 rounded-full border-2 border-urgent"
          />
          <span
            aria-hidden="true"
            className="ring-2 pointer-events-none absolute inset-0 rounded-full border-2 border-urgent"
          />
        </>
      )}
    </button>
  );
}

function EnginePicker({
  engines,
  value,
  open,
  onToggle,
  onSelect,
}: {
  engines: EngineOption[];
  value: EngineId;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: EngineId) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep"
      >
        מנוע תמלול
        <IconChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <ul className="absolute bottom-full end-0 z-40 mb-2 w-[min(320px,calc(100vw-3rem))] overflow-hidden rounded-card border border-line bg-card shadow-lift">
          {engines.map((engine) => (
            <li key={engine.id}>
              <button
                type="button"
                disabled={!engine.supported}
                onClick={() => onSelect(engine.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-start last:border-b-0 transition-colors",
                  engine.supported
                    ? "hover:bg-page-deep"
                    : "cursor-not-allowed opacity-50",
                  engine.id === value && "bg-navy-wash/60",
                )}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold text-navy-deep">
                  {engine.label}
                  {engine.id === value && (
                    <IconCheck className="h-4 w-4 text-navy" />
                  )}
                  <span
                    className={cn(
                      "ms-auto rounded-chip border px-2 py-0.5 text-[11px] font-medium",
                      engine.onDevice
                        ? "border-stable-line bg-stable-bg text-stable"
                        : "border-attention-line bg-attention-bg text-attention",
                    )}
                  >
                    {engine.onDevice ? "על המכשיר" : "שירות חיצוני"}
                  </span>
                </span>
                <span className="text-[12px] leading-relaxed text-ink-muted">
                  {engine.supported
                    ? engine.description
                    : "אינו נתמך בדפדפן הזה."}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function stateLabel(phase: Phase, progress: number | null): string {
  switch (phase) {
    case "preparing":
      return progress !== null
        ? `טוען מודל תמלול… ${Math.round(progress * 100)}%`
        : "טוען מודל תמלול…";
    case "ready":
      return "מוכן להקלטה";
    case "recording":
      return "מקליט…";
    case "paused":
      return "מושהה";
    case "structuring":
      return "מסדר את המידע…";
    case "review":
      return "טיוטה לסקירה";
    case "failed":
      return "ההקלטה נעצרה";
    default:
      return "מוכן להקלטה";
  }
}

function engineLabelFor(engines: EngineOption[], id: EngineId): string {
  return engines.find((e) => e.id === id)?.label ?? "";
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
