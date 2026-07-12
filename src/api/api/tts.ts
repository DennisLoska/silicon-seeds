import { TTS } from "../../tts/tts";
import { TTSVoice } from "../../tts/types";

export async function tts_profiles() {
  const voices = await TTS.listVoices();
  return new Response(JSON.stringify(voices), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function tts_profiles_options() {
  const voices = await TTS.listVoices();

  const options = voices
    .map(
      (v: TTSVoice) =>
        `<option value="${v.id}">${v.name} (${v.language}, ${v.voiceType})</option>`,
    )
    .join("");

  return new Response(options || "<option value='' disabled>Voicebox unavailable</option>", {
    headers: { "Content-Type": "text/html" },
  });
}
