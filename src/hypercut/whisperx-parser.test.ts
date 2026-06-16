import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseWhisperX } from "./whisperx-parser";

let TEST_PATH: string;

describe("parseWhisperX", () => {
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "whisperx-test-"));
    TEST_PATH = join(dir, "test.json");
  });

  test("reads timed words from JSON file", async () => {
    await Bun.write(
      TEST_PATH,
      JSON.stringify({
        segments: [
          {
            words: [
              { word: "hello", start: 0.1, end: 0.3 },
              { word: "world", start: 0.4, end: 0.6 },
            ],
          },
        ],
      }),
    );

    const words = await parseWhisperX(TEST_PATH);
    expect(words).toHaveLength(2);
    expect(words[0].word).toBe("hello");
    expect(words[0].start).toBe(0.1);
    expect(words[1].end).toBe(0.6);
  });

  test("skips words with missing timestamps", async () => {
    await Bun.write(
      TEST_PATH,
      JSON.stringify({
        segments: [
          {
            words: [
              { word: "hello", start: 0.1, end: 0.3 },
              { word: "world" },
            ],
          },
        ],
      }),
    );

    const words = await parseWhisperX(TEST_PATH);
    expect(words).toHaveLength(1);
  });

  afterEach(() => {
    try {
      const dir = require("node:path").dirname(TEST_PATH);
      require("node:fs").rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });
});
