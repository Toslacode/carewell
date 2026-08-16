import {
  type TranscriptionEvents,
  type TranscriptionProvider,
} from "@/lib/transcription/types";

/**
 * A scripted engine for demonstrating without a microphone.
 *
 * This exists so the flow can be shown in a room with no mic, a denied
 * permission, or a stage laptop — and it is labelled as scripted everywhere it
 * appears. It is not a fallback that silently stands in for a broken engine:
 * a demo that looks like live transcription but isn't would be exactly the
 * dishonesty this product cannot afford.
 */

const SCRIPT: Array<{ text: string; delay: number }> = [
  { text: "היה לו חום 39 בלילה", delay: 1400 },
  { text: "לחץ דם 105 על 65", delay: 1800 },
  { text: "עדיין משתעל", delay: 1500 },
  { text: "ברקע סוכרת ויתר לחץ דם", delay: 2000 },
  { text: "גר לבד והבת שלו עוזרת לו", delay: 2200 },
  { text: "נעשה צילום חזה היום ונחזור על ספירת דם", delay: 2400 },
  { text: "כנראה דלקת ריאות", delay: 1600 },
  { text: "אם יהיה שיפור אולי נוכל לשחרר מחר", delay: 2200 },
];

export class DemoProvider implements TranscriptionProvider {
  readonly id = "demo";
  readonly label = "מצב בדיקה — תמליל קבוע";
  readonly description =
    "מריץ תמליל כתוב מראש בלי לגעת במיקרופון. אינו מתמלל דיבור — לבדיקת הזרימה בלבד, ולא לסבב אמיתי.";
  readonly onDevice = true;

  private events: TranscriptionEvents = {};
  private timers: ReturnType<typeof setTimeout>[] = [];
  private levelTimer = 0;
  private index = 0;
  private paused = false;

  isSupported(): boolean {
    return true;
  }

  async prepare(events: TranscriptionEvents): Promise<void> {
    this.events = events;
    this.index = 0;
    events.onStatus?.("ready");
  }

  async start(): Promise<void> {
    this.paused = false;
    this.events.onStatus?.("recording");
    this.animateLevel();
    this.queueNext();
  }

  private queueNext() {
    if (this.paused || this.index >= SCRIPT.length) return;
    const line = SCRIPT[this.index];
    const timer = setTimeout(() => {
      if (this.paused) return;
      // A partial first, then the settled line — the same shape a real engine
      // produces, so the UI is exercised identically.
      this.events.onPartial?.(line.text.slice(0, Math.ceil(line.text.length / 2)));
      const settle = setTimeout(() => {
        if (this.paused) return;
        this.events.onFinal?.(line.text);
        this.index += 1;
        this.queueNext();
      }, 420);
      this.timers.push(settle);
    }, line.delay);
    this.timers.push(timer);
  }

  private animateLevel() {
    let t = 0;
    const step = () => {
      t += 0.1;
      const level = this.paused
        ? 0
        : 0.25 + Math.abs(Math.sin(t * 1.7)) * 0.4 + Math.random() * 0.12;
      this.events.onLevel?.(Math.min(1, level));
      this.levelTimer = requestAnimationFrame(step);
    };
    step();
  }

  pause(): void {
    this.paused = true;
    this.clearTimers();
    this.events.onLevel?.(0);
    this.events.onStatus?.("paused");
  }

  resume(): void {
    this.paused = false;
    this.events.onStatus?.("recording");
    this.queueNext();
  }

  async stop(): Promise<void> {
    this.paused = true;
    this.clearTimers();
    cancelAnimationFrame(this.levelTimer);
    this.events.onLevel?.(0);
    this.events.onStatus?.("ready");
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  dispose(): void {
    this.clearTimers();
    cancelAnimationFrame(this.levelTimer);
  }
}
