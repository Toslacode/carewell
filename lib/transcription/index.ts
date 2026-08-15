import { DemoProvider } from "@/lib/transcription/demo";
import { WebSpeechProvider } from "@/lib/transcription/web-speech";
import { WhisperProvider } from "@/lib/transcription/whisper";
import type { TranscriptionProvider } from "@/lib/transcription/types";

export type EngineId = "web-speech" | "whisper-local" | "demo";

export function createProvider(id: EngineId): TranscriptionProvider {
  switch (id) {
    case "whisper-local":
      return new WhisperProvider();
    case "demo":
      return new DemoProvider();
    case "web-speech":
    default:
      return new WebSpeechProvider();
  }
}

export interface EngineOption {
  id: EngineId;
  label: string;
  description: string;
  onDevice: boolean;
  supported: boolean;
}

/** Engine metadata for the picker, evaluated against the current browser. */
export function listEngines(): EngineOption[] {
  return (["web-speech", "whisper-local", "demo"] as EngineId[]).map((id) => {
    const p = createProvider(id);
    const option: EngineOption = {
      id,
      label: p.label,
      description: p.description,
      onDevice: p.onDevice,
      supported: p.isSupported(),
    };
    p.dispose();
    return option;
  });
}

export const DEFAULT_ENGINE: EngineId = "web-speech";

export * from "@/lib/transcription/types";
