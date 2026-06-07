import { Event, JobMode } from "../events/events";
import { LLM } from "../llm/llm";
import { comfyClient } from "../comfyui/comfyui-client";
import { Presets, StylePresets } from "../styles/presets";
import { ImageGenerator } from "../image/image-generator";
import { VideoGenerator } from "../video/video-generator";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";
import z from "zod/v3";

export type AutoCutRemovalSpan = {
  start: number;
  end: number;
  text: string;
  reason: "filler" | "restart" | "obvious_mistake" | "silence";
  confidence?: number;
};

export type AutoCutInsertion = {
  timestamp: number;
  transcriptContext: string;
  prompt: string;
};

export namespace PromptGenerator {
  const JobNameSchema = z.object({
    words: z.array(z.string().trim().min(2).max(20)).min(3).max(4),
  });

  const AutoCutRemovalSchema = z
    .object({
      start: z.number().min(0),
      end: z.number().min(0),
      text: z.string().trim().min(1).max(240),
      reason: z.enum(["filler", "restart", "obvious_mistake"]),
      confidence: z.number().min(0).max(1),
    })
    .refine((value) => value.end > value.start, {
      message: "Removal span end must be greater than start",
    });

  const AutoCutPlanSchema = z.object({
    removals: z.array(AutoCutRemovalSchema).max(200),
  });

  const AutoCutInsertionSchema = z.object({
    timestamp: z.number().min(0),
    transcriptContext: z.string().trim().min(10).max(400),
    prompt: z.string().trim().min(10).max(400),
  });

  const AutoCutInsertionPlanSchema = z.object({
    insertions: z.array(AutoCutInsertionSchema).max(20),
  });

  interface WhisperXWord {
    word?: string;
    start?: number;
    end?: number;
  }

  interface WhisperXSegment {
    start?: number;
    end?: number;
    text?: string;
    words?: WhisperXWord[];
  }

  interface WhisperXTranscript {
    language?: string;
    segments?: WhisperXSegment[];
  }

  function autocut_chunk_prompt(
    language: string | undefined,
    chunkIndex: number,
    totalChunks: number,
    chunkText: string,
  ) {
    return `You are cleaning a spoken video transcript for automatic timeline editing.

Task:
- identify only spans that should be removed from the original video
- remove filler words such as "um", "uh", "ah", "mh", "hmm" when they function as filler
- remove obvious false starts or speaker restarts when the sentence is immediately repeated or corrected
- remove obvious speech mistakes only when the speaker clearly retries or corrects the phrase right away
- keep meaningful wording, intentional pauses, emphasis, and rhetorical repetition
- never invent timestamps
- only return spans present in the transcript excerpt

Transcript language: ${language ?? "unknown"}
Chunk ${chunkIndex + 1} of ${totalChunks}

Each word line includes exact start and end timestamps in seconds.

Transcript excerpt:
${chunkText}

Return structured data only.`;
  }

  function timedWordsForAutocut(transcript: WhisperXTranscript) {
    return (transcript.segments ?? []).flatMap((segment, segmentIndex) => {
      const words = (segment.words ?? [])
        .map((word) => {
          const text = word.word?.trim();
          if (!text || word.start === undefined || word.end === undefined) {
            return null;
          }

          return {
            segmentIndex,
            start: word.start,
            end: word.end,
            text,
            segmentText: segment.text?.trim() ?? "",
          };
        })
        .filter(
          (
            word,
          ): word is {
            segmentIndex: number;
            start: number;
            end: number;
            text: string;
            segmentText: string;
          } => word !== null,
        );

      return words;
    });
  }

  function buildAutocutChunks(transcript: WhisperXTranscript) {
    const words = timedWordsForAutocut(transcript);
    if (words.length === 0) return [];

    const chunks: string[] = [];

    // WhisperX JSON can exceed local model context on long uploads, so chunk transcript windows
    // and merge the structured removals rather than sending the full file in one prompt.
    const chunkSize = 180;
    const overlap = 24;

    for (let start = 0; start < words.length; start += chunkSize - overlap) {
      const slice = words.slice(start, start + chunkSize);
      if (slice.length === 0) continue;

      const lines = slice.map(
        (word) =>
          `${word.start.toFixed(2)}-${word.end.toFixed(2)} | seg:${word.segmentIndex} | word:${word.text} | context:${word.segmentText}`,
      );

      chunks.push(lines.join("\n"));

      if (start + chunkSize >= words.length) {
        break;
      }
    }

    return chunks;
  }

  function dedupeAutocutRemovals(removals: AutoCutRemovalSpan[]) {
    const keyed = new Map<string, AutoCutRemovalSpan>();

    for (const removal of removals) {
      const start = Math.round(removal.start * 1000) / 1000;
      const end = Math.round(removal.end * 1000) / 1000;
      const key = `${start}:${end}:${removal.reason}`;
      const previous = keyed.get(key);

      if (!previous || (removal.confidence ?? 0) > (previous.confidence ?? 0)) {
        keyed.set(key, {
          ...removal,
          start,
          end,
        });
      }
    }

    return Array.from(keyed.values()).sort((a, b) => a.start - b.start);
  }

  function insertion_chunk_prompt(
    language: string | undefined,
    chunkIndex: number,
    totalChunks: number,
    chunkText: string,
    desiredCount: number,
  ) {
    return `You are planning visually rich insert clips for an edited talking video.

Task:
- identify moments in the transcript where a short generated visual insert would strengthen the video
- prefer concrete, imagistic, or conceptually rich moments
- keep timestamps exact to the transcript excerpt
- choose moments that can be represented by one short image-to-video clip
- avoid too many inserts; only return high-value ones
- write prompts suitable for the existing image prompt pipeline and later image-to-video generation
- prompts should be cinematic, visual, and specific, but should not mention text overlays

Transcript language: ${language ?? "unknown"}
Chunk ${chunkIndex + 1} of ${totalChunks}
Desired insertions from this chunk: up to ${desiredCount}

Transcript excerpt:
${chunkText}

Return structured data only.`;
  }

  function dedupeInsertions(insertions: AutoCutInsertion[]) {
    const keyed = new Map<string, AutoCutInsertion>();

    for (const insertion of insertions) {
      const timestamp = Math.round(insertion.timestamp * 1000) / 1000;
      const key = `${timestamp}:${insertion.prompt.toLowerCase()}`;
      if (!keyed.has(key)) {
        keyed.set(key, {
          ...insertion,
          timestamp,
        });
      }
    }

    return Array.from(keyed.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  export async function job_name(originalPrompt?: string | null) {
    const promptContext = originalPrompt?.trim().slice(0, 600);

    for (let attempt = 0; attempt < 5; attempt++) {
      const variationHint = Bun.randomUUIDv7().slice(-6);
      const res = await LLM.structured(
        `Generate a fun, memorable title for a generative media job.

Requirements:
- return exactly 3 or 4 words
- each word must be vivid and concise
- use title-friendly words only
- no punctuation
- no numbers
- no generic filler words like "the", "and", "for", "with"
- the full title should feel playful, creative, and slightly poetic

${
  promptContext
    ? `Creative context from the user's initial prompt:
${promptContext}

Reflect the subject or mood of that prompt in the title without copying long phrases.

`
    : ""
}Variation hint for this attempt: ${variationHint}

Return structured data only.
`,
        JobNameSchema,
      );

      const candidate = res?.parsed?.words.join(" ");

      if (!candidate) {
        Logger.warn("Failed to generate job name, retrying", { attempt });
        continue;
      }

      if (!(await DB.Jobs.findByName(candidate))) {
        return candidate;
      }

      Logger.warn("Generated duplicate job name, retrying", {
        candidate,
        attempt,
      });
    }

    return `Job ${Date.now()}`;
  }

  async function styled_image_prompt(message: string, preset?: Presets) {
    const styleFn = preset
      ? StylePresets.presets[preset]
      : StylePresets.presets[Presets.SYSTEM];

    const { instructions, lora } = styleFn({ title: message });

    const res = await LLM.message(
      `Create excellent image prompt(s) based on these instructions:

${instructions}

Make sure to only include the actual image prompt in your response and nothing more!
`,
    );

    if (res === null || !res.content || res.content.trim() === "") {
      Logger.warn("Failed to generate image prompt - skipping");
      return null;
    }

    return {
      prompt: res.content.trim(),
      lora,
    };
  }

  export async function txt_to_img_prompt(
    message: string,
    batchSize = 1,
    preset?: Presets,
  ) {
    const prompts = [];

    for (let i = 0; i < batchSize; i++) {
      const styled = await styled_image_prompt(message, preset);
      prompts.push(styled);
      if (!styled) {
        return null;
      }
    }

    return prompts;
  }

  export async function styled_img_to_event(
    jobId: string,
    mode: JobMode,
    message: string,
    preset?: Presets,
    index?: number,
    id?: string,
  ) {
    const styled = await styled_image_prompt(message, preset);
    if (!styled) {
      return null;
    }

    return await ImageGenerator.schedule_image({
      id,
      jobId,
      mode,
      prompt: styled.prompt,
      lora: styled.lora,
      index,
    });
  }

  export async function img_to_vid_prompt(promptId: string) {
    const event = await DB.Events.findById(promptId);
    Utils.assert(
      event,
      "Unable to find associated event with image for image-to-video prompt.",
    );

    if (event.type !== Event.NewImagePrompt) return;

    const res = await comfyClient.getImageOutput(promptId);
    if (res === null) {
      Logger.info("Failed to fetch image location for video prompt");
      return null;
    }

    const { filename, subfolder, kind } = res;
    const img = await comfyClient.getAsset(filename, subfolder, kind);
    const buffer = await img.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const image = await LLM.client.files.prepareImageBase64(filename, base64);

    const response = await LLM.message(
      `Generate a detailed video generation prompt for a 5 second long video based on the content of the image.
The video itself should be slow paced without any rapid movement as if time moves a bit slower.

The camera movement should be slow and steady and should not change meaning if the camera does a fade in it should
not do a fade out anymore, but just to continue with the fade in motion until the very end of the video.
The fade in motion is just an example. Depending on the image it makes sense to have no camera movement at all or
to use a different motion like:

fade in, fade out, pan left, pan right, tilt top, tilt bottom

It is very important that you describe the ending position of the video to prevent the video from looping.

Also consider the original prompt which was used to generate the image for richer context:

${event.prompt}

Make sure to only include the actual video generation prompt in your response and nothing more!
`,
      [image],
    );

    if (!response?.content) {
      Logger.warn("Failed to generate video prompt - skipping");
      return null;
    }

    return { prompt: response.content, filename };
  }

  export function script_prompt(description: string) {
    return `Create a text script / essay based on the following description: ${description}

If the description does not provide details about the length of the essay make sure it is between
800 and 1300 words long depending on the subject.

Make sure to remove any markdown syntax so that the content is just plain text.

Your response should only include the actual essay including it's title and nothing more!
`;
  }

  export async function image_scene_prompts(
    text: string,
    amount: number,
  ): Promise<string[] | null> {
    {
      const list_prompt = `Image Prompt Instructions:

- Generate a list of ${amount} stylistic, holistically coherent image prompts
- Ensure each prompt is not longer than ~25-50 words
- Content: The different prompts should be unique and have a great amount of variety
between them to ensure the final composition will consist of a wide range of
different scenes which all refer to the same story or script
- Style: The prompts should all follow the same style and vibe to ensure the final
composition looks coherent and like all scenes belong together, but they should not be
too similar to each other. The style should be cinematic, detailed, and visually rich.
- Your response should only include the list of image prompts - nothing more!
- There should be no duplicate prompts in the list make sure each prompt is unique!
- The resulting images should contain no text or words in them at all so do not
put any descriptions or instructions for visualizing words, slogans or texts
into the actual prompts. There should be no words, signs.
- Your response should only include the list of generated image prompts

Create a list of ${amount} image prompts in chronological
order which should describe this video script visually in it's totality from
start to finish:

${text}
`;
      const res = await LLM.image_prompt_list(list_prompt, amount);
      if (!res?.parsed) return null;

      let scenes = Object.values(res.parsed);
      Logger.info("scenes: ", res.parsed);
      Logger.info("amount: ", amount);
      Logger.info("actual: ", scenes.length);

      if (!Array.isArray(scenes)) return null;
      Utils.assert(
        scenes.length >= amount,
        "LLM did not generate the desired amount of scene prompts.",
      );

      if (scenes.length > amount) {
        Logger.warn(
          "The model generated more prompts than requested, slicing the array!",
          {
            expected: amount,
            actual: scenes.length,
            scenes,
          },
        );

        scenes = scenes.slice(0, amount);
      }

      return scenes;
    }
  }

  export async function autocut_plan_from_whisperx_json(jsonPath: string) {
    const transcript = (await Bun.file(jsonPath).json()) as WhisperXTranscript;
    const chunks = buildAutocutChunks(transcript);

    if (chunks.length === 0) {
      return {
        removals: [] as AutoCutRemovalSpan[],
        warnings: [
          "WhisperX JSON did not contain timed words, so only silence trimming can run.",
        ],
      };
    }

    const chunkResults = await Promise.all(
      chunks.map((chunk, index) =>
        LLM.structured(
          autocut_chunk_prompt(
            transcript.language,
            index,
            chunks.length,
            chunk,
          ),
          AutoCutPlanSchema,
        ),
      ),
    );

    const removals = chunkResults
      .flatMap((result) => result?.parsed?.removals ?? [])
      .map(
        (removal) =>
          ({
            start: removal.start,
            end: removal.end,
            text: removal.text,
            reason: removal.reason,
            confidence: removal.confidence,
          }) satisfies AutoCutRemovalSpan,
      );

    const warnings: string[] = [];
    if (chunks.length > 1) {
      warnings.push(
        `Transcript analysis was chunked into ${chunks.length} windows to stay inside local-model context limits.`,
      );
    }

    if (chunkResults.some((result) => result === null)) {
      warnings.push(
        "At least one transcript-analysis chunk failed and was skipped.",
      );
    }

    return {
      removals: dedupeAutocutRemovals(removals),
      warnings,
    };
  }

  export async function autocut_insertions_from_whisperx_json(
    jsonPath: string,
    desiredCount = 3,
  ) {
    const transcript = (await Bun.file(jsonPath).json()) as WhisperXTranscript;
    const chunks = buildAutocutChunks(transcript);

    if (chunks.length === 0) {
      return {
        insertions: [] as AutoCutInsertion[],
        warnings: [
          "WhisperX JSON did not contain timed words, so no insertion prompts could be planned.",
        ],
      };
    }

    const perChunk = Math.max(1, Math.ceil(desiredCount / chunks.length));
    const results = await Promise.all(
      chunks.map((chunk, index) =>
        LLM.structured(
          insertion_chunk_prompt(
            transcript.language,
            index,
            chunks.length,
            chunk,
            perChunk,
          ),
          AutoCutInsertionPlanSchema,
        ),
      ),
    );

    const insertions = results
      .flatMap((result) => result?.parsed?.insertions ?? [])
      .map(
        (item) =>
          ({
            timestamp: item.timestamp,
            transcriptContext: item.transcriptContext,
            prompt: item.prompt,
          }) satisfies AutoCutInsertion,
      );

    const warnings: string[] = [];
    if (chunks.length > 1) {
      warnings.push(
        `Insertion planning was chunked into ${chunks.length} windows to stay inside local-model context limits.`,
      );
    }

    if (results.some((result) => result === null)) {
      warnings.push(
        "At least one insertion-planning chunk failed and was skipped.",
      );
    }

    return {
      insertions: dedupeInsertions(insertions).slice(0, desiredCount),
      warnings,
    };
  }
}
