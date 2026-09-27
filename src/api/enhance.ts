import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { ENHANCE_KINDS, enhancePrompt } from "../prompts/prompt-enhancer";

const EnhanceSchema = z.object({
  text: z.string().max(2000).default(""),
  kind: z.enum(ENHANCE_KINDS),
  style_preset: z.string().min(1).max(50).optional(),
});

const app = new Hono();

app.post("/", zValidator("json", EnhanceSchema), async (c) => {
  const { text, kind, style_preset } = c.req.valid("json");
  const out = await enhancePrompt(text ?? "", kind, style_preset);
  if (!out) return c.json({ error: "LLM unavailable, try again" }, 502);
  return c.json({ enhanced: out });
});

export default app;
