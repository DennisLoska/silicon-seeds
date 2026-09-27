export const ENHANCE_KINDS = ["image_prompt","video_prompt","style_guide","script","instrumental","lyrics"] as const;
export type EnhanceKind = typeof ENHANCE_KINDS[number];

const KIND_HINT: Record<EnhanceKind,string> = {
  image_prompt: "detailed image prompt with subject, composition, lighting, lens, mood",
  video_prompt: "detailed video prompt with subject, motion, camera move, lighting, mood",
  style_guide: "coherent visual style guide: medium, palette, lighting, texture, consistency rules",
  script: "rich video script essay with structure, narration beats, visual cues",
  instrumental: "instrumental arrangement brief: tempo, key, instruments, mood arc, mix notes",
  lyrics: "lyric concept: theme, imagery, rhyme feel, hook idea, verse direction",
};

export function buildEnhancePrompt(text: string, kind: EnhanceKind, presetText?: string): string {
  const hint = KIND_HINT[kind];
  const preset = presetText ? `\nStay consistent with style preset:\n${presetText}\nDo not contradict it.` : "";
  return `Enhance this ${kind} into a longer enriched ${hint}. Keep language of original. Original:\n${text}${preset}\nReturn only the enhanced text, no quotes, no preamble.`;
}

export function buildInspirePrompt(kind: EnhanceKind, presetText?: string): string {
  const hint = KIND_HINT[kind];
  const preset = presetText ? `\nStay consistent with style preset:\n${presetText}` : "";
  return `Invent a random high-quality ${kind}: ${hint}.${preset}\nReturn only the invented text, no quotes, no preamble.`;
}

import { LLM } from "../llm/llm";
import { DB } from "../db/db";

export async function enhancePrompt(text: string, kind: EnhanceKind, presetName?: string): Promise<string | null> {
  let presetText: string | undefined;
  if (presetName && presetName !== "none") {
    try {
      const row = await DB.StylePresets.findByName(presetName);
      if (row) presetText = `primary:${row.primary_style} secondary:${row.secondary_trigger ?? ""} styles:${row.styles_json} texture:${row.texture ?? ""}`;
    } catch { presetText = undefined; }
  }
  const clean = text.trim();
  const msg = clean.length === 0 ? buildInspirePrompt(kind, presetText) : buildEnhancePrompt(clean.slice(0,2000), kind, presetText);
  const res = await LLM.message(msg);
  if (!res || !res.content) return null;
  return res.content.trim();
}
