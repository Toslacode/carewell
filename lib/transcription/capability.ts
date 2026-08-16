/**
 * What can this environment actually do with a microphone?
 *
 * Live transcription has four separate ways to be impossible, and they need
 * different answers from the person in front of the screen:
 *
 *   · the page is not a secure context      → getUserMedia does not exist
 *   · the browser has no speech recogniser  → Chrome/Edge/Safari only
 *   · the page is framed without permission → an embed, not the app
 *   · the user or the OS refused            → a permission dialog
 *
 * A single "microphone unavailable" would be true and useless. This reports
 * which one it is, and what the reader can do about it.
 *
 * The probe is deliberately passive: it never calls getUserMedia, so it never
 * raises a permission prompt nobody asked for. The definitive answer still
 * comes from pressing record — this only says, in advance, whether pressing it
 * can possibly work here.
 */

export type MicBlock = "insecure" | "no-speech-api" | "framed" | "unknown";

export interface MicCapability {
  /** True when nothing detectable stands in the way of a live round. */
  ready: boolean;
  block: MicBlock | null;
  /** One sentence, in Hebrew, stating the situation. */
  message: string;
  /** What to do about it, or null when there is nothing to do. */
  remedy: string | null;
  /** True when the page is inside an iframe — the artifact preview case. */
  framed: boolean;
}

interface FeaturePolicyLike {
  allowsFeature(feature: string): boolean;
}

function speechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Whether this frame is permitted to use a microphone at all.
 *
 * Returns null when the browser gives us no way to know — Safari and Firefox do
 * not expose a permissions policy — in which case we do not claim it is blocked.
 * Guessing "blocked" here would send a reader off to a different browser for no
 * reason; the record button will tell the truth either way.
 */
function framePermitsMicrophone(): boolean | null {
  if (typeof document === "undefined") return null;
  const policy = (document as unknown as { featurePolicy?: FeaturePolicyLike }).featurePolicy;
  if (!policy || typeof policy.allowsFeature !== "function") return null;
  try {
    return policy.allowsFeature("microphone");
  } catch {
    return null;
  }
}

export function probeMicrophone(): MicCapability {
  if (typeof window === "undefined") {
    return { ready: false, block: "unknown", message: "", remedy: null, framed: false };
  }

  const framed = window.self !== window.top;

  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return {
      ready: false,
      block: "insecure",
      message: "הדפדפן חוסם מיקרופון בעמוד שאינו מאובטח.",
      remedy: "יש לפתוח את האפליקציה בכתובת https או ב־localhost.",
      framed,
    };
  }

  if (!speechRecognitionAvailable()) {
    return {
      ready: false,
      block: "no-speech-api",
      message: "הדפדפן הזה אינו כולל מנוע תמלול חי.",
      remedy: "תמלול עברית חי נתמך ב־Chrome, Edge וספארי. אפשר גם לבחור מנוע אחר.",
      framed,
    };
  }

  if (framed && framePermitsMicrophone() === false) {
    return {
      ready: false,
      block: "framed",
      message: "התצוגה המוטמעת הזו חסומה לגישה למיקרופון.",
      remedy:
        "יש לפתוח את הדף בכרטיסייה נפרדת כדי לאשר מיקרופון ולהקליט בקול אמיתי. עד אז אפשר לבחור ״מצב בדיקה״ ולראות את הזרימה על תמליל קבוע.",
      framed,
    };
  }

  return {
    ready: true,
    block: null,
    message: "מיקרופון זמין — לחצו ״התחל סבב״ ואשרו את בקשת ההרשאה.",
    remedy: null,
    framed,
  };
}
