/**
 * Input level metering, shared by every engine.
 *
 * The browser speech API exposes no signal level, so the waveform is driven
 * from a parallel analyser on the same MediaStream. This also gives us an
 * honest "no audio detected" state: a microphone that is connected, permitted,
 * and silent is a real failure mode during a ward round — a muted headset, a
 * device the OS routed elsewhere — and it should be reported rather than
 * looking like a working recorder that heard nothing.
 */

const SILENCE_THRESHOLD = 0.012;
const SILENCE_GRACE_MS = 6000;

export class AudioMeter {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private raf = 0;
  private lastSound = 0;
  private silenceReported = false;

  constructor(
    private readonly onLevel: (level: number) => void,
    private readonly onSilence: () => void,
  ) {}

  attach(stream: MediaStream) {
    this.detach();
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.65;
    this.source.connect(this.analyser);
    this.buffer = new Uint8Array(this.analyser.fftSize);
    this.lastSound = Date.now();
    this.silenceReported = false;
    this.tick();
  }

  private tick = () => {
    const analyser = this.analyser;
    if (!analyser) return;

    analyser.getByteTimeDomainData(this.buffer as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const v = (this.buffer[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buffer.length);
    // Perceptual curve — linear RMS makes speech look like a flat line.
    const level = Math.min(1, Math.pow(rms * 3.2, 0.65));
    this.onLevel(level);

    const now = Date.now();
    if (rms > SILENCE_THRESHOLD) {
      this.lastSound = now;
      this.silenceReported = false;
    } else if (!this.silenceReported && now - this.lastSound > SILENCE_GRACE_MS) {
      this.silenceReported = true;
      this.onSilence();
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
      void this.ctx?.close();
    } catch {
      // Closing an already-closed context is not an error worth surfacing.
    }
    this.ctx = null;
    this.source = null;
    this.analyser = null;
  }
}
