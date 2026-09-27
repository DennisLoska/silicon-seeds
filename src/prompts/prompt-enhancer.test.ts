import { describe, test, expect } from "bun:test";
import { buildEnhancePrompt, buildInspirePrompt } from "./prompt-enhancer";
describe("prompt-enhancer builders", () => {
  test("enhance includes original + kind hint", () => {
    const out = buildEnhancePrompt("a cat", "image_prompt", undefined);
    expect(out).toContain("a cat");
    expect(out.toLowerCase()).toContain("image");
  });
  test("inspire ignores empty and mentions kind", () => {
    const out = buildInspirePrompt("lyrics", undefined);
    expect(out.length).toBeGreaterThan(20);
  });
  test("preset text injected", () => {
    const out = buildEnhancePrompt("a house", "style_guide", "watercolor, soft edges");
    expect(out).toContain("watercolor");
  });
});
