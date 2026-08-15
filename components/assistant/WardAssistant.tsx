"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASSISTANT_SUGGESTIONS,
  type AssistantAnswer,
  askWard,
  searchableLines,
  termMatches,
  wardDigest,
} from "@/lib/ai/ward-assistant";
import { useWard } from "@/lib/store/ward-store";
import type { Patient } from "@/lib/schemas/clinical";
import { cn } from "@/lib/utils/cn";
import { IconChevron, IconClose, IconMessage, IconSend } from "@/components/ui/icons";

/**
 * The ward assistant.
 *
 * Ask a question, get an answer built out of the ward's own records: a count or
 * a sentence, then the patients it was computed from, each with the chart line
 * that matched and a link to the record. Nothing on screen is text a model
 * wrote about a patient — the model, when it is available, only chooses which
 * patients answer the question.
 */

interface Turn {
  question: string;
  answer: AssistantAnswer;
  pending?: boolean;
}

export function WardAssistant({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { rooms, patients } = useWard();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;

      const ward = { rooms, patients };
      // The deterministic answer is computed first and shown immediately, so
      // the panel is never empty and never depends on the network.
      const local = askWard(q, ward);
      setTurns((prev) => [...prev, { question: q, answer: local, pending: true }]);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q, digest: wardDigest(ward) }),
        });
        if (!res.ok) throw new Error("unavailable");
        const body = (await res.json()) as {
          ok: boolean;
          answer?: { headline: string; patientIds: string[]; note: string | null };
        };
        if (!body.ok || !body.answer) throw new Error("unavailable");

        // Ids the model returned that we do not have are dropped rather than
        // rendered: it can be wrong about relevance, never about who exists.
        const known = body.answer.patientIds.filter((id) => patients[id]);
        const terms = local.terms;
        const upgraded: AssistantAnswer = {
          headline: body.answer.headline,
          note: body.answer.note,
          terms,
          engine: "claude",
          hits: known.map((id) => {
            const p = patients[id];
            const line =
              searchableLines(p).find((l) => terms.some((t) => termMatches(l.text, t))) ??
              searchableLines(p)[0];
            return { patientId: id, where: line.where, quote: line.text };
          }),
        };
        setTurns((prev) =>
          prev.map((t, i) =>
            i === prev.length - 1 ? { ...t, answer: upgraded, pending: false } : t,
          ),
        );
      } catch {
        // The retrieval answer stands on its own; mark it as the final one.
        setTurns((prev) =>
          prev.map((t, i) => (i === prev.length - 1 ? { ...t, pending: false } : t)),
        );
      }
    },
    [patients, rooms],
  );

  const roomNumber = (p: Patient) =>
    rooms.find((r) => r.id === p.roomId)?.number ?? "—";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[rgba(28,24,18,.24)] motion-safe:animate-[carewell-rise_.25s_ease-out_both]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="עוזר המחלקה"
        className={cn(
          "fixed inset-y-0 end-0 z-50 flex w-[min(430px,100vw)] flex-col border-s border-line bg-card/95 shadow-lift backdrop-blur-xl",
          "motion-safe:animate-[carewell-in_.34s_cubic-bezier(.22,.61,.36,1)_both]",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-navy text-on-navy">
            <IconMessage className="h-[18px] w-[18px]" />
          </span>
          <h2 className="flex-1 text-[16px] font-bold text-navy-deep">עוזר המחלקה</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-muted transition-colors hover:bg-page-deep hover:text-ink"
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div ref={logRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
          {turns.length === 0 ? (
            <>
              <div className="rounded-[16px_16px_4px_16px] border border-line bg-card-raised px-3.5 py-3">
                <p className="text-[14px] font-semibold leading-relaxed text-navy-deep">
                  שאלו על המחלקה — התשובה נשלפת מהרשומות עצמן.
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                  כל תשובה מגיעה עם המטופלים והשורות שממנה חושבה, כדי שאפשר יהיה
                  לבדוק אותה מול הרשומה.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ASSISTANT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void ask(s)}
                    className="rounded-chip border border-line-strong bg-card px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className="flex flex-col gap-3.5">
                <p className="max-w-[88%] self-start rounded-[16px_16px_16px_4px] bg-navy px-3.5 py-2.5 text-[14px] text-on-navy">
                  {turn.question}
                </p>
                <div className="rounded-[16px_16px_4px_16px] border border-line bg-card-raised px-3.5 py-3">
                  <p
                    className={cn(
                      "text-[14px] font-semibold leading-relaxed text-navy-deep transition-opacity",
                      turn.pending && "opacity-70",
                    )}
                  >
                    {turn.answer.headline}
                  </p>
                  {turn.answer.note && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                      {turn.answer.note}
                    </p>
                  )}

                  {turn.answer.hits.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {turn.answer.hits.map((hit, k) => {
                        const p = patients[hit.patientId];
                        if (!p) return null;
                        return (
                          <button
                            key={`${hit.patientId}-${k}`}
                            type="button"
                            onClick={() => {
                              onClose();
                              router.push(`/patients/${p.id}`);
                            }}
                            className="flex w-full items-start gap-2 rounded-[12px] border border-line bg-card px-2.5 py-2 text-start transition-colors hover:border-line-strong hover:bg-page-deep"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="text-[13px] font-semibold text-navy-deep">
                                {p.name}
                              </span>
                              <span className="text-[11px] text-ink-decor">
                                {" · "}חדר <span className="tnum">{roomNumber(p)}</span>,
                                מיטה <span className="tnum">{p.bed}</span> · {hit.where}
                              </span>
                              <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                                <Highlighted text={hit.quote} terms={turn.answer.terms} />
                              </span>
                            </span>
                            <IconChevron className="h-4 w-4 shrink-0 text-ink-decor" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <form
          className="flex gap-2 border-t border-line px-3.5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const q = value;
            setValue("");
            void ask(q);
          }}
        >
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="למשל: כמה מטופלים מקבלים מורפיום"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-chip border border-line-strong bg-card-raised px-4 py-2.5 text-[14px] text-ink outline-none focus:border-navy"
          />
          <button
            type="submit"
            aria-label="שליחה"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-chip bg-navy text-on-navy transition-colors hover:bg-navy-deep"
          >
            <IconSend className="h-5 w-5" />
          </button>
        </form>

        <p className="border-t border-line px-4 pb-3.5 pt-2.5 text-[11px] leading-relaxed text-ink-muted">
          התשובות נשלפות מהרשומות הטעונות באפליקציה — שמונה הקטגוריות, המשימות,
          הייעוצים והחסמים — ומצוטטות כלשונן. כשאין מפתח API התשובה מגיעה ממנוע
          החיפוש המקומי. כל הנתונים בדיוניים.
        </p>
      </aside>
    </>
  );
}

/** Marks the searched terms inside a quoted line, so the reason a patient came
 *  back is visible rather than asserted. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${terms
      .filter((t) => t.length >= 3)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="rounded-[3px] bg-info-bg px-0.5 text-info">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
