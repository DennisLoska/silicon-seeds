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
