/**
 * The speech-engine boundary.
 *
 * The recording UI talks only to this interface, so the engine underneath can
 * be swapped — browser API today, local Whisper on the same page, a hospital's
 * own on-prem service later — without the UI changing. Nothing above this line
 * knows what a SpeechRecognition or an ONNX session is.
 */

export type TranscriptionStatus =
  | "idle"
  /** Downloading or compiling a model. `progress` is 0–1 when known. */
  | "loading"
  | "ready"
  | "recording"
  | "paused"
  | "stopping"
  | "error";

export type TranscriptionErrorCode =
  | "not-supported"
  | "permission-denied"
  | "no-microphone"
  | "no-audio"
  | "model-failed"
  | "network"
  | "unknown";

export interface TranscriptionError {
  code: TranscriptionErrorCode;
  /** Hebrew, user-facing, and specific enough to act on. */
  message: string;
  /** Whether retrying without changing anything could plausibly work. */
  retryable: boolean;
}

export interface TranscriptionEvents {
  /** Best-guess text for the utterance in progress. Replaces the previous
   *  partial; never appended to. */
  onPartial?: (text: string) => void;
  /** A settled segment. Appended to the transcript and never revised. */
  onFinal?: (text: string) => void;
  onStatus?: (status: TranscriptionStatus, progress?: number) => void;
  onError?: (error: TranscriptionError) => void;
  /** 0–1 input level, for the waveform. Emitted at animation rate. */
  onLevel?: (level: number) => void;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly label: string;
  /** Shown in the engine picker so the trade-off is visible, not hidden. */
  readonly description: string;
  /** True when this engine can run in the current browser at all. */
  isSupported(): boolean;
  /** Whether audio leaves the device. Surfaced in the UI — it matters. */
  readonly onDevice: boolean;

  /** Acquire mic + prepare the engine. Safe to call more than once. */
  prepare(events: TranscriptionEvents): Promise<void>;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  dispose(): void;
}

export function transcriptionError(
  code: TranscriptionErrorCode,
  message: string,
  retryable = true,
): TranscriptionError {
  return { code, message, retryable };
}

/** Maps a getUserMedia rejection to something a doctor can act on. */
export function micError(err: unknown): TranscriptionError {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return transcriptionError(
      "permission-denied",
      "הגישה למיקרופון נחסמה. יש לאשר גישה בהגדרות הדפדפן ולנסות שוב.",
      true,
    );
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return transcriptionError(
      "no-microphone",
      "לא נמצא מיקרופון מחובר. חברו מיקרופון ונסו שוב.",
      true,
    );
  }
  if (name === "NotReadableError") {
    return transcriptionError(
      "no-microphone",
      "המיקרופון תפוס על ידי יישום אחר. סגרו אותו ונסו שוב.",
      true,
    );
  }
  return transcriptionError(
    "unknown",
    "לא ניתן להפעיל את המיקרופון. נסו שוב.",
    true,
  );
}
