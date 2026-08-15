import { AudioMeter } from "@/lib/transcription/audio-meter";
import {
  type TranscriptionEvents,
  type TranscriptionProvider,
  micError,
  transcriptionError,
} from "@/lib/transcription/types";

/**
 * Whisper, running on this device.
 *
 * The audio never leaves the browser: transformers.js runs whisper-small in
 * WASM/WebGPU and the model is cached by the browser after the first load.
 * That is the property that would make this viable for real patient data,
 * which the browser speech API is not.
 *
 * The honest costs, stated because they are real and the UI shows them:
 *   · First use downloads a few hundred MB. Subsequent loads are cached.
 *   · It transcribes in windows, not continuously — text lands in chunks of a
 *     few seconds rather than word by word.
 *   · Hebrew accuracy below `small` is poor, so `small` is the floor here.
 *
 * If the runtime cannot start — no WASM, no network for the first fetch, an
 * unsupported device — this reports a specific error. It never falls back to
 * pretending it transcribed something.
 */

/** Seconds of audio per transcription window. Long enough for Whisper to have
 *  useful context, short enough that the doctor sees text arriving. */
const WINDOW_SECONDS = 6;
const SAMPLE_RATE = 16000;

type Pipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string } | Array<{ text: string }>>;

export class WhisperProvider implements TranscriptionProvider {
  readonly id = "whisper-local";
  readonly label = "Whisper מקומי";
  readonly description =
    "תמלול על המכשיר — השמע אינו יוצא מהדפדפן. הורדה ראשונית של מודל, ותמלול במקטעים.";
  readonly onDevice = true;

  private pipe: Pipeline | null = null;
  private stream: MediaStream | null = null;
  private meter: AudioMeter | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private events: TranscriptionEvents = {};
  private chunks: Float32Array[] = [];
  private chunkSamples = 0;
  private running = false;
  private paused = false;
  private busy = false;

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof WebAssembly === "object" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }

  async prepare(events: TranscriptionEvents): Promise<void> {
    this.events = events;

    if (!this.isSupported()) {
      events.onError?.(
        transcriptionError(
          "not-supported",
          "הדפדפן אינו תומך בהרצת מודל מקומי.",
          false,
        ),
      );
      events.onStatus?.("error");
      return;
    }

    events.onStatus?.("loading", 0);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      events.onError?.(micError(err));
      events.onStatus?.("error");
      return;
    }

    try {
      // Dynamic so the runtime is only fetched when this engine is chosen —
      // the browser-speech default never pays for it.
      const { pipeline } = await import("@huggingface/transformers");
      const asr = await pipeline(
        "automatic-speech-recognition",
        "onnx-community/whisper-small",
        {
          dtype: "q4",
          progress_callback: (p: unknown) => {
            const info = p as { status?: string; progress?: number };
            if (info?.status === "progress" && typeof info.progress === "number") {
              events.onStatus?.("loading", Math.min(1, info.progress / 100));
            }
          },
        },
      );
      this.pipe = asr as unknown as Pipeline;
    } catch {
      events.onError?.(
        transcriptionError(
          "model-failed",
          "טעינת מודל התמלול המקומי נכשלה. בטעינה ראשונה נדרש חיבור לרשת להורדת המודל.",
          true,
        ),
      );
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
    if (!this.stream || !this.pipe) return;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor({ sampleRate: SAMPLE_RATE });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but universally available; an AudioWorklet
    // would need a separate module file for marginal benefit at this buffer
    // size, and this path is not on the render-critical thread.
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);

    this.node.onaudioprocess = (event) => {
      if (!this.running || this.paused) return;
      const input = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      this.chunkSamples += input.length;
      if (this.chunkSamples >= SAMPLE_RATE * WINDOW_SECONDS) void this.flush();
    };

    this.source.connect(this.node);
    // A zero-gain sink: some browsers stop pulling from a ScriptProcessor that
    // is not connected to the destination.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.node.connect(sink);
    sink.connect(this.ctx.destination);

    this.running = true;
    this.paused = false;
    this.meter?.attach(this.stream);
    this.events.onStatus?.("recording");
  }

  private async flush(): Promise<void> {
    if (this.busy || this.chunkSamples === 0 || !this.pipe) return;
    this.busy = true;

    const audio = new Float32Array(this.chunkSamples);
    let offset = 0;
    for (const chunk of this.chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    this.chunkSamples = 0;

    try {
      const result = await this.pipe(audio, {
        language: "hebrew",
        task: "transcribe",
        chunk_length_s: WINDOW_SECONDS + 2,
      });
      const text = Array.isArray(result)
        ? result.map((r) => r.text).join(" ")
        : result.text;
      const clean = text?.trim();
      if (clean) this.events.onFinal?.(clean);
    } catch {
      this.events.onError?.(
        transcriptionError(
          "model-failed",
          "התמלול המקומי נכשל על מקטע אחד. ההקלטה נמשכת.",
          true,
        ),
      );
    } finally {
      this.busy = false;
    }
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    void this.flush();
    this.meter?.detach();
    this.events.onLevel?.(0);
    this.events.onStatus?.("paused");
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this.stream) this.meter?.attach(this.stream);
    this.events.onStatus?.("recording");
  }

  async stop(): Promise<void> {
    this.events.onStatus?.("stopping");
    this.running = false;
    this.paused = false;
    // Transcribe whatever is left rather than discarding the tail of the round.
    await this.flush();
    this.teardownAudio();
    this.meter?.detach();
    this.events.onLevel?.(0);
    this.events.onStatus?.("ready");
  }

  private teardownAudio() {
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      void this.ctx?.close();
    } catch {
      /* already torn down */
    }
    this.node = null;
    this.source = null;
    this.ctx = null;
  }

  dispose(): void {
    this.running = false;
    this.teardownAudio();
    this.meter?.detach();
    this.meter = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.pipe = null;
  }
}
