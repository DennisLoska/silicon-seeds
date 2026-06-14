import type { TimedWord } from "./hypercut-transcript-analyzer";

interface WhisperXWord {
  word?: string;
  start?: number;
  end?: number;
}

interface WhisperXSegment {
  words?: WhisperXWord[];
}

interface WhisperXTranscript {
  segments?: WhisperXSegment[];
}

export async function parseWhisperX(jsonPath: string): Promise<TimedWord[]> {
  const data = (await Bun.file(jsonPath).json()) as WhisperXTranscript;
  const words: TimedWord[] = [];

  for (const segment of data.segments ?? []) {
    for (const w of segment.words ?? []) {
      if (w.word && w.start !== undefined && w.end !== undefined) {
        words.push({
          word: w.word.trim(),
          start: w.start,
          end: w.end,
        });
      }
    }
  }

  return words;
}
