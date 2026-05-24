import z from "zod";
import { Presets } from "../styles/presets";

export const PostTextToImageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  resolution: z.string().max(7).optional(),
  image_model: z.string().max(50),
  style_preset: z.enum(Presets).optional(),
  batch_size: z.coerce.number().int().positive().optional(),
});

export type PostTextToImage = z.infer<typeof PostTextToImageSchema>;

export const PostComposeSchema = z
  .object({
    script: z.string().optional(),
    script_file: z.instanceof(File).optional(),
    image_model: z.string().max(50),
    video_model: z.string().max(50),
    resolution: z.string().max(7),
    fps: z.coerce.number().min(1).max(24),
    clip_duration: z.coerce.number().min(1).max(10),
    transition_duration: z.coerce.number().min(1).max(10),
    style_preset: z.enum(Presets),
  })
  .refine(
    (data) => {
      const hasScript = data.script && data.script.trim().length >= 3;
      const hasFile = data.script_file !== undefined;
      return hasScript || hasFile;
    },
    {
      message: "Either script or script_file must be provided",
    },
  );

export type PostCompose = z.infer<typeof PostComposeSchema>;

export const PostDistinctAudioSchema = z.object({
  instrumental_prompt: z.string().min(1, "Instrumental prompt is required"),
  lyric_prompt: z.string().optional(),
  duration: z.coerce.number().int().min(10).max(180),
  bpm: z.coerce.number().int().min(40).max(240),
  cfg_scale: z.coerce.number().min(0).max(10),
  temperature: z.coerce.number().min(0).max(2),
  top_p: z.coerce.number().min(0).max(1),
  keyscale: z.string().min(1).max(20),
  timesignature: z.enum(["3", "4", "5", "6", "7"]),
});

export type PostDistinctAudio = z.infer<typeof PostDistinctAudioSchema>;
