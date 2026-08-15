import { type Extraction, ExtractionSchema } from "@/lib/schemas/clinical";
import { extractByRules } from "@/lib/ai/rules";

/**
 * The extraction facade the UI talks to.
 *
 * Claude when a key is configured, the deterministic Hebrew extractor when it
 * isn't — or when the network is down, the request fails, or the response
 * fails validation. The user flow is identical either way; only the engine
 * badge changes, and it changes honestly.
 */

export type ExtractionEngine = "claude" | "rules";

export interface ExtractionResult {
  extraction: Extraction;
  engine: ExtractionEngine;
  /** Why the API path wasn't used, when it wasn't. Surfaced in the UI. */
  fallbackReason?: FallbackReason;
}

export type FallbackReason =
  | "no-api-key"
  | "offline"
  | "rate-limited"
  | "refused"
  | "truncated"
  | "malformed"
  | "unavailable";

const REASONS: ReadonlyArray<FallbackReason> = [
  "no-api-key",
  "offline",
  "rate-limited",
  "refused",
  "truncated",
  "malformed",
  "unavailable",
];

/** Hebrew, user-facing, and specific about what actually happened. */
export const FALLBACK_MESSAGE: Record<FallbackReason, string> = {
  "no-api-key": "מנוע ה־AI אינו מוגדר — פועל מיון מקומי.",
  offline: "אין חיבור לרשת — פועל מיון מקומי.",
  "rate-limited": "מנוע ה־AI עמוס כרגע — פועל מיון מקומי.",
  refused: "מנוע ה־AI לא עיבד את הקטע — פועל מיון מקומי.",
  truncated: "התשובה נקטעה — פועל מיון מקומי.",
  malformed: "התקבלה תשובה לא תקינה — פועל מיון מקומי.",
  unavailable: "מנוע ה־AI אינו זמין — פועל מיון מקומי.",
};

export const ENGINE_LABEL: Record<ExtractionEngine, string> = {
  claude: "מיון AI",
  rules: "מיון מקומי",
};

function asReason(value: unknown): FallbackReason {
  return REASONS.includes(value as FallbackReason)
    ? (value as FallbackReason)
    : "unavailable";
}

export async function extract(
  transcript: string,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  const clean = transcript.trim();
  if (!clean) {
    return { extraction: ExtractionSchema.parse({}), engine: "rules" };
  }

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: clean }),
      signal,
    });

    const body = (await response.json()) as
      | { ok: true; extraction: unknown }
      | { ok: false; reason?: string };

    if (response.ok && body.ok) {
      // Validated on the server and again here: the boundary is enforced on
      // whichever side of it you are standing.
      const parsed = ExtractionSchema.safeParse(body.extraction);
      if (parsed.success) {
        return { extraction: parsed.data, engine: "claude" };
      }
      return {
        extraction: extractByRules(clean),
        engine: "rules",
        fallbackReason: "malformed",
      };
    }

    return {
      extraction: extractByRules(clean),
      engine: "rules",
      fallbackReason: asReason(body.ok === false ? body.reason : undefined),
    };
  } catch (err) {
    // An aborted request is the caller changing its mind, not a failure.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      extraction: extractByRules(clean),
      engine: "rules",
      fallbackReason:
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "unavailable",
    };
  }
}
