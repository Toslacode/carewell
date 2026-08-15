"use client";

import { useEffect, useRef, useState } from "react";
import type { ClinicalItem } from "@/lib/schemas/clinical";
import { cn } from "@/lib/utils/cn";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/primitives";

/** How long an AI-placed line keeps its "just arrived" wash. */
const FRESH_MS = 6000;

export function isFresh(addedAt?: number): boolean {
  return typeof addedAt === "number" && Date.now() - addedAt < FRESH_MS;
}

/**
 * A list of clinical lines, each independently editable.
 *
 * The unit of correction is the line, not the section: a doctor who hears the
 * system mis-transcribe one creatinine value should fix that value and nothing
 * else. Every line also shows where it came from, because "the AI said this"
 * and "I wrote this" are different kinds of claim.
 */
export function EditableList({
  items,
  emptyLabel,
  onEdit,
  onDelete,
  onAdd,
  addLabel = "הוספה",
  bulleted = true,
}: {
  items: ClinicalItem[];
  emptyLabel: string;
  onEdit: (itemId: string, text: string) => void;
  onDelete: (itemId: string) => void;
  onAdd: (text: string) => void;
  addLabel?: string;
  bulleted?: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      {items.length === 0 && !adding && (
        <p className="py-0.5 text-[14px] text-ink-muted">{emptyLabel}</p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {items.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              bulleted={bulleted}
              onEdit={(text) => onEdit(entry.id, text)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <InlineInput
          initial=""
          placeholder="הוספת שורה…"
          onCancel={() => setAdding(false)}
          onSave={(text) => {
            onAdd(text);
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-chip px-2 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
        >
          <IconPlus className="h-4 w-4" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function Row({
  entry,
  bulleted,
  onEdit,
  onDelete,
}: {
  entry: ClinicalItem;
  bulleted: boolean;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const fresh = isFresh(entry.addedAt);

  if (editing) {
    return (
      <li>
        <InlineInput
          initial={entry.text}
          onCancel={() => setEditing(false)}
          onSave={(text) => {
            onEdit(text);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li
      // Double-click is the fast path; the pencil is the discoverable one. A
      // doctor correcting a mis-heard creatinine mid-round should be able to
      // hit the number itself rather than aim for a 15px icon that only
      // appears on hover.
      onDoubleClick={() => setEditing(true)}
      className={cn(
        "group/row flex items-start gap-2 rounded-md py-1 pe-1 ps-1.5 transition-colors hover:bg-page-deep/60",
        // A line the AI just placed arrives rather than appearing.
        fresh && "reveal shown",
        fresh && "settle",
      )}
    >
      {bulleted && (
        <span
          aria-hidden="true"
          className={cn(
            "mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full",
            entry.source === "ai" ? "bg-info" : "bg-ink-decor",
          )}
        />
      )}

      <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink">
        {entry.text}
        {entry.source === "ai" && (
          <span className="ms-2 align-middle rounded-chip border border-info-line bg-info-bg px-1.5 py-px text-[10px] font-semibold text-info">
            טיוטת AI
          </span>
        )}
      </span>

      {/* Controls stay in the DOM for keyboard and screen-reader users; they
          only fade in visually on hover/focus so the record stays calm. */}
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
        <IconButton label="עריכה" onClick={() => setEditing(true)} className="h-7 w-7">
          <IconPencil className="h-[15px] w-[15px]" />
        </IconButton>
        <IconButton
          label="מחיקה"
          onClick={onDelete}
          className="h-7 w-7 hover:text-urgent"
        >
          <IconTrash className="h-[15px] w-[15px]" />
        </IconButton>
      </span>
    </li>
  );
}

export function InlineInput({
  initial,
  placeholder,
  onSave,
  onCancel,
  ltr = false,
}: {
  initial: string;
  placeholder?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  ltr?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const clean = value.trim();
    if (clean) onSave(clean);
    else onCancel();
  };

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={commit}
        className={cn(
          "min-w-0 flex-1 rounded-md border border-navy/40 bg-card-raised px-2.5 py-1.5 text-[14px] text-ink",
          "outline-none focus:border-navy",
          ltr && "ltr",
        )}
      />
      <IconButton label="שמירה" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
        <IconCheck className="h-4 w-4 text-stable" />
      </IconButton>
    </div>
  );
}
