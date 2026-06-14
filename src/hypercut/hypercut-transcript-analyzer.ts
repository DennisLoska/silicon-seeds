export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface RemovalSpan {
  start: number;
  end: number;
  text: string;
  reason: "filler" | "pause" | "restart";
}

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "ah",
  "mh",
  "hmm",
  "er",
  "erm",
  "uhm",
  "mm",
  "mhm",
]);

export function detectFillers(words: TimedWord[]): RemovalSpan[] {
  const spans: RemovalSpan[] = [];
  for (const word of words) {
    const clean = word.word.toLowerCase().replace(/[^a-z]/g, "");
    if (FILLER_WORDS.has(clean)) {
      spans.push({
        start: word.start,
        end: word.end,
        text: word.word.trim(),
        reason: "filler",
      });
    }
  }
  return spans;
}

export function detectPauses(
  words: TimedWord[],
  thresholdSeconds = 1.5,
): RemovalSpan[] {
  const spans: RemovalSpan[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= thresholdSeconds) {
      spans.push({
        start: words[i - 1].end,
        end: words[i].start,
        text: "[pause]",
        reason: "pause",
      });
    }
  }
  return spans;
}

export function detectRestarts(words: TimedWord[]): RemovalSpan[] {
  const spans: RemovalSpan[] = [];

  for (let i = 1; i < words.length; i++) {
    const prev = normalizeWord(words[i - 1].word);
    const curr = normalizeWord(words[i].word);

    // Detect immediate exact repetition: "the the", "a a"
    if (prev && prev === curr && prev.length > 1) {
      spans.push({
        start: words[i - 1].start,
        end: words[i].end,
        text: `${words[i - 1].word} ${words[i].word}`,
        reason: "restart",
      });
      continue;
    }

    // Detect pattern "word X word" with short gap (false start corrected)
    if (i >= 2) {
      const before = normalizeWord(words[i - 2].word);
      if (
        before &&
        before === curr &&
        before.length > 3 &&
        words[i].start - words[i - 2].end < 2.0
      ) {
        spans.push({
          start: words[i - 2].start,
          end: words[i - 1].end,
          text: words.slice(i - 2, i).map((w) => w.word).join(" "),
          reason: "restart",
        });
      }
    }
  }

  return mergeOverlappingSpans(spans);
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

function mergeOverlappingSpans(spans: RemovalSpan[]): RemovalSpan[] {
  if (spans.length === 0) return [];

  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: RemovalSpan[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      last.text = `${last.text} ${current.text}`;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function analyzeTranscript(words: TimedWord[]): RemovalSpan[] {
  const fillers = detectFillers(words);
  const pauses = detectPauses(words);
  const restarts = detectRestarts(words);
  return mergeOverlappingSpans([...fillers, ...pauses, ...restarts]);
}
