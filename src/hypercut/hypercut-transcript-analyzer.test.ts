import { describe, expect, test } from "bun:test";
import {
  analyzeTranscript,
  detectFillers,
  detectPauses,
  detectRestarts,
} from "./hypercut-transcript-analyzer";

describe("detectFillers", () => {
  test("finds um and uh", () => {
    const words = [
      { word: "um", start: 0.1, end: 0.3 },
      { word: "hello", start: 0.4, end: 0.8 },
      { word: "uh", start: 0.9, end: 1.0 },
    ];
    const result = detectFillers(words);
    expect(result).toHaveLength(2);
    expect(result[0].reason).toBe("filler");
    expect(result[1].reason).toBe("filler");
  });

  test("ignores non-filler words", () => {
    const words = [
      { word: "hello", start: 0.1, end: 0.3 },
      { word: "world", start: 0.4, end: 0.8 },
    ];
    expect(detectFillers(words)).toHaveLength(0);
  });
});

describe("detectPauses", () => {
  test("finds long gaps", () => {
    const words = [
      { word: "a", start: 0, end: 0.2 },
      { word: "b", start: 2.0, end: 2.2 },
    ];
    const result = detectPauses(words);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("pause");
    expect(result[0].start).toBe(0.2);
    expect(result[0].end).toBe(2.0);
  });

  test("ignores short gaps", () => {
    const words = [
      { word: "a", start: 0, end: 0.2 },
      { word: "b", start: 0.5, end: 0.7 },
    ];
    expect(detectPauses(words)).toHaveLength(0);
  });
});

describe("detectRestarts", () => {
  test("finds immediate word repetition", () => {
    const words = [
      { word: "the", start: 0, end: 0.2 },
      { word: "the", start: 0.3, end: 0.5 },
      { word: "cat", start: 0.6, end: 0.8 },
    ];
    const result = detectRestarts(words);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].reason).toBe("restart");
  });
});

describe("analyzeTranscript", () => {
  test("merges overlapping spans", () => {
    const words = [
      { word: "um", start: 0.1, end: 0.3 },
      { word: "hello", start: 0.4, end: 0.8 },
      { word: "uh", start: 0.9, end: 1.0 },
    ];
    const result = analyzeTranscript(words);
    const fillers = result.filter((r) => r.reason === "filler");
    expect(fillers).toHaveLength(2);
  });
});
