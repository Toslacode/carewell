import { AudioMeter } from "@/lib/transcription/audio-meter";
import {
  type TranscriptionEvents,
  type TranscriptionProvider,
  micError,
  transcriptionError,
} from "@/lib/transcription/types";

/* The Web Speech API is still vendor-prefixed and absent from lib.dom in some
   TS configurations, so the shape we rely on is declared here rather than
   asserted away with `any`. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Hebrew transcription via the browser's own speech service.
 *
 * Accurate, instant to start, and free — but the audio is processed by the
 * browser vendor's service, not on this device. That is stated plainly in the
 * engine picker rather than buried, because it is exactly the property that
 * would disqualify it for real patients. For fictitious demonstration data it
 * is the right default; for a real deployment it would not be.
 */
export class WebSpeechProvider implements TranscriptionProvider {
  readonly id = "web-speech";
  readonly label = "מנוע דפדפן";
  readonly description =
    "תמלול עברית מהיר וללא הורדה. השמע מעובד בשירות של הדפדפן ולא במכשיר.";
  readonly onDevice = false;

  private recognition: SpeechRecognitionLike | null = null;
  private stream: MediaStream | null = null;
  private meter: AudioMeter | null = null;
  private events: TranscriptionEvents = {};
  private running = false;
  private paused = false;
  /** Chrome ends the session after a silence; we restart it so a round can run
   *  as long as the doctor is in the room. This flag separates "it stopped by
   *  itself" from "the doctor pressed stop". */
  private restarting = false;

  isSupported(): boolean {
    return getCtor() !== null;
  }

  async prepare(events: TranscriptionEvents): Promise<void> {
    this.events = events;
    if (!this.isSupported()) {
      events.onError?.(
        transcriptionError(
          "not-supported",
          "הדפדפן הזה אינו תומך בתמלול חי. נסו Chrome או Edge, או עברו למנוע מקומי.",
          false,
        ),
      );
      events.onStatus?.("error");
      return;
    }

    events.onStatus?.("loading");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      events.onError?.(micError(err));
      events.onStatus?.("error");
      return;
    }

    this.meter = new AudioMeter(
      (level) => events.onLevel?.(level),
      () =>
        events.onError?.(
          transcriptionError(
            "no-audio",
            "לא נקלט שמע כבר כמה שניות. בדקו שהמיקרופון אינו מושתק.",
            true,
          ),
        ),
    );

    events.onStatus?.("ready");
  }

  async start(): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor || !this.stream) return;

    const recognition = new Ctor();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (!text) continue;
        if (result.isFinal) this.events.onFinal?.(text.trim());
        else partial += text;
      }
      if (partial) this.events.onPartial?.(partial.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.events.onError?.(
          transcriptionError(
            "permission-denied",
            "הגישה למיקרופון נחסמה. יש לאשר גישה בהגדרות הדפדפן.",
          ),
        );
        this.events.onStatus?.("error");
        return;
      }
      if (event.error === "network") {
        this.events.onError?.(
          transcriptionError(
            "network",
            "מנוע התמלול של הדפדפן אינו זמין כרגע. בדקו את החיבור או עברו למנוע מקומי.",
          ),
        );
        this.events.onStatus?.("error");
        return;
      }
      if (event.error === "service-not-allowed" || event.error === "language-not-supported") {
        this.events.onError?.(
          transcriptionError(
            "not-supported",
            "מנוע התמלול של הדפדפן אינו זמין בבנייה הזו של הדפדפן. נסו Chrome או Edge רגילים, או עברו למנוע מקומי.",
            false,
          ),
        );
        this.events.onStatus?.("error");
        return;
      }
      this.events.onError?.(
        transcriptionError("unknown", "התמלול נעצר."),
      );
    };

    recognition.onend = () => {
      // Silence ends the session; restart unless we stopped on purpose.
      if (this.running && !this.paused) {
        this.restarting = true;
        try {
          recognition.start();
        } catch {
          this.restarting = false;
        }
      }
    };

    this.recognition = recognition;
    this.running = true;
    this.paused = false;
    this.meter?.attach(this.stream);

    try {
      recognition.start();
      this.events.onStatus?.("recording");
    } catch {
      this.events.onError?.(
        transcriptionError("unknown", "לא ניתן להתחיל הקלטה. נסו שוב."),
      );
      this.events.onStatus?.("error");
    }
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.recognition?.stop();
    this.meter?.detach();
    this.events.onLevel?.(0);
    this.events.onStatus?.("paused");
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this.stream) this.meter?.attach(this.stream);
    try {
      this.recognition?.start();
      this.events.onStatus?.("recording");
    } catch {
      // Already running — the restart handler beat us to it.
      this.events.onStatus?.("recording");
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.paused = false;
    this.restarting = false;
    this.events.onStatus?.("stopping");
    try {
      this.recognition?.stop();
    } catch {
      /* already stopped */
    }
    this.meter?.detach();
    this.events.onLevel?.(0);
    this.events.onStatus?.("ready");
  }

  dispose(): void {
    this.running = false;
    try {
      this.recognition?.abort();
    } catch {
      /* already gone */
    }
    this.recognition = null;
    this.meter?.detach();
    this.meter = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
