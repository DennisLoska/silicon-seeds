import { describe, expect, test } from "bun:test";
import { parseWhisperX } from "./whisperx-parser";

const TEST_PATH = "/tmp/test-whisperx.json";

describe("parseWhisperX", () => {
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
});
