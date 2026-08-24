import z from "zod";
import { Presets } from "../styles/presets";

const AudioKeyscaleSchema = z.enum([
  "C major",
  "A minor",
  "D minor",
  "E minor",
  "G major",
  "B minor",
  "F# minor",
]);

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
    voice_id: z.string().optional(),
    style_guide: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
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

export const PostAutoCutSchema = z.object({
  video_file: z.instanceof(File),
  generate_insert_clips: z.preprocess((value) => {
    if (value === undefined) return false;

    const rawValue = Array.isArray(value) ? value.at(-1) : value;
    if (typeof rawValue === "string") {
      return ["true", "on", "1"].includes(rawValue.toLowerCase());
    }

    return Boolean(rawValue);
  }, z.boolean()),
  image_model: z.string().max(50).optional(),
  video_model: z.string().max(50).optional(),
  resolution: z.string().max(7).optional(),
  fps: z.coerce.number().min(1).max(24).optional(),
  clip_duration: z.coerce.number().min(1).max(10).optional(),
  transition_duration: z.coerce.number().min(1).max(10).optional(),
  style_preset: z.enum(Presets).optional(),
}).superRefine((data, ctx) => {
  if (!data.generate_insert_clips) return;

  if (!data.image_model) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["image_model"],
      message: "Image model is required when AI inserts are enabled",
    });
  }

  if (!data.video_model) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_model"],
      message: "Video model is required when AI inserts are enabled",
    });
  }

  if (!data.resolution) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolution"],
      message: "Resolution is required when AI inserts are enabled",
    });
  }

  if (data.fps === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fps"],
      message: "FPS is required when AI inserts are enabled",
    });
  }

  if (data.clip_duration === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clip_duration"],
      message: "Clip duration is required when AI inserts are enabled",
    });
  }

  if (data.transition_duration === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transition_duration"],
      message: "Transition duration is required when AI inserts are enabled",
    });
  }

  if (!data.style_preset) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["style_preset"],
      message: "Style preset is required when AI inserts are enabled",
    });
  }
});

export type PostAutoCut = z.infer<typeof PostAutoCutSchema>;

export const PostDistinctAudioSchema = z.object({
  instrumental_prompt: z.string().min(1, "Instrumental prompt is required"),
  lyric_prompt: z.string().min(1, "Lyric prompt is required"),
  duration: z.coerce.number().int().min(10).max(720),
  bpm: z.coerce.number().int().min(40).max(240),
  cfg_scale: z.coerce.number().min(0).max(10),
  temperature: z.coerce.number().min(0).max(2),
  top_p: z.coerce.number().min(0).max(1),
  keyscale: AudioKeyscaleSchema,
  timesignature: z.enum(["2", "3", "4", "6"]),
});

export type PostDistinctAudio = z.infer<typeof PostDistinctAudioSchema>;
