import { Logger } from "../logger/logger";
import type { TTSGenerateOptions, TTSGenerateResult, TTSVoice } from "./types";

export type { TTSVoice, TTSGenerateOptions, TTSGenerateResult };

const VOICEBOX_URL = Bun.env.VOICEBOX_URL ?? "http://127.0.0.1:17493";

// Every Voicebox fetch AND its body read share one AbortController, so a slow
// or stalled body (res.json()/res.blob()) cannot hang dispatch forever. A
// stuck speech dispatch holds the global single-slot queue (hasRunning gate),
// wedging all pending events. Keep every call site bounded.
async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<{ res: Response; data: T }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = (await res.json()) as T;
    return { res, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBlobWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<{ res: Response; blob: Blob }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const blob = await res.blob();
    return { res, blob };
  } finally {
    clearTimeout(timeout);
  }
}

function mapProfile(raw: Record<string, unknown>): TTSVoice {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    language: (raw.language as string) ?? "en",
    voiceType: (raw.voice_type as string) ?? "cloned",
    engine:
      (raw.default_engine as string) ?? (raw.preset_engine as string) ?? null,
    sampleCount: (raw.sample_count as number) ?? 0,
  };
}

function mapPreset(raw: Record<string, unknown>): TTSVoice {
  const id = raw.voice_id as string;
  return {
    id: `preset:kokoro:${id}`,
    name: raw.name as string,
    description: `Kokoro preset · ${raw.gender as string}`,
    language: (raw.language as string) ?? "en",
    voiceType: "preset",
    engine: "kokoro",
    sampleCount: 0,
  };
}

export namespace TTS {
  export async function listVoices(): Promise<TTSVoice[]> {
    const voices: TTSVoice[] = [];

    try {
      const res = await fetch(`${VOICEBOX_URL}/profiles`);
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>[];
        voices.push(
          ...data
            .filter((p) => !(p.name as string).startsWith("_preset_"))
            .map(mapProfile),
        );
      }
    } catch (error) {
      /* voicebox unreachable */
      Logger.error("Voicebox error", error);
    }

    try {
      const res = await fetch(`${VOICEBOX_URL}/profiles/presets/kokoro`);
      if (res.ok) {
        const data = (await res.json()) as {
          voices: Record<string, unknown>[];
        };
        const allowed = new Set([
          "af_bella",
          "af_heart",
          "am_adam",
          "am_michael",
        ]);
        voices.push(
          ...data.voices
            .filter((v) => allowed.has(v.voice_id as string))
            .map(mapPreset),
        );
      }
    } catch (error) {
      /* presets unreachable */
      Logger.error("Voicebox error", error);
    }

    return voices;
  }

  export async function generate(
    options: TTSGenerateOptions,
  ): Promise<TTSGenerateResult> {
    const { text, voiceId, language } = options;

    const profileId = await resolveProfileId(voiceId);

    const engine = voiceId.startsWith("preset:")
      ? voiceId.split(":")[1]
      : undefined;

    const { res, data: gen } = await fetchJsonWithTimeout<
      Record<string, unknown>
    >(
      `${VOICEBOX_URL}/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          text: text.slice(0, 4000),
          language: language ?? "en",
          ...(engine ? { engine } : {}),
        }),
      },
      15000,
    );
    if (!res.ok) {
      throw new Error(`Voicebox generate failed: ${res.status}`);
    }
    const duration = (gen.duration as number) ?? 0;
    const generationId = gen.id as string;

    const audioBlob = await waitForAudio(generationId);
    const outputDir = Bun.env.OUTPUT_DIR;
    if (!outputDir) throw new Error("OUTPUT_DIR env not set");

    const filename = `tts/${options.id}.wav`;
    await Bun.write(`${outputDir}/${filename}`, audioBlob);

    return { duration, filename };
  }
}

async function resolveProfileId(voiceId: string): Promise<string> {
  if (!voiceId.startsWith("preset:")) return voiceId;

  const parts = voiceId.split(":");
  const engine = parts[1];
  const presetVoiceId = parts[2];

  const profileName = `_preset_${presetVoiceId}`;

  const { res: existingRes, data: profiles } = await fetchJsonWithTimeout<
    {
      id: string;
      name: string;
    }[]
  >(`${VOICEBOX_URL}/profiles`, {}, 10000);
  if (existingRes.ok) {
    const match = profiles.find((p) => p.name === profileName);
    if (match) return match.id;
  }

  const { res, data: profile } = await fetchJsonWithTimeout<{ id: string }>(
    `${VOICEBOX_URL}/profiles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profileName,
        description: `Auto-imported preset: ${presetVoiceId}`,
        language: "en",
        voice_type: "preset",
        preset_engine: engine,
        preset_voice_id: presetVoiceId,
      }),
    },
    10000,
  );

  if (!res.ok) {
    throw new Error(`Failed to create preset profile: ${res.status}`);
  }

  return profile.id;
}

async function waitForAudio(generationId: string): Promise<Blob> {
  for (let i = 0; i < 60; i++) {
    try {
      const { res, blob } = await fetchBlobWithTimeout(
        `${VOICEBOX_URL}/audio/${generationId}`,
        {},
        5000,
      );
      if (res.ok) {
        if (blob.size > 100) return blob;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Voicebox audio not ready after 60s");
}
