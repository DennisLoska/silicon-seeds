import z from "zod";
import { Presets } from "../styles/presets";

export const PostComposeSchema = z.object({
  script: z.string().min(3),
  image_model: z.string().max(50),
  video_model: z.string().max(50),
  fps: z.number().min(1).max(24),
  clip_duration: z.number().min(1).max(10),
  transition_duration: z.number().min(1).max(10),
  style_preset: z.enum(Presets),
});

export type PostCompose = z.infer<typeof PostComposeSchema>;
