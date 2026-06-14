# HyperCut Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the HyperCut page and backend pipeline so users can upload a video, get autocut removal suggestions and ChromaDB content suggestions, manually place them on a Hyperframes Studio timeline, and render a final composition.

**Architecture:** HTMX/DaisyUI shell with a React island for Hyperframes Studio. Independent HyperCut transcript analyzer (no AutoCut dependency). MCP-video subprocess for Hyperframes rendering. SQLite tables for suggestions and clips.

**Tech Stack:** Bun, TypeScript, Hono, Kysely, SQLite, HTMX, DaisyUI, React, Hyperframes Studio, MCP-video, WhisperX, ChromaDB

---

## Task 1: Database schema for HyperCut

**Files:**
- Modify: `src/db/db.ts`
- Test: `bunx tsc --noEmit`

- [ ] **Step 1: Add `hypercut_suggestions` table migration**

In `src/db/db.ts`, add to `migrations` list before any query helpers:

```ts
{
  name: "add_hypercut_suggestions",
  sql: `
    CREATE TABLE IF NOT EXISTS hypercut_suggestions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL CHECK(source_type IN ('image', 'video', 'text', 'autocut_cut')),
      asset_id TEXT REFERENCES meta(id) ON DELETE SET NULL,
      text_content TEXT,
      transcript_anchor_start REAL NOT NULL,
      transcript_anchor_end REAL NOT NULL,
      score REAL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
},
{
  name: "add_hypercut_clips",
  sql: `
    CREATE TABLE IF NOT EXISTS hypercut_clips (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      suggestion_id TEXT REFERENCES hypercut_suggestions(id) ON DELETE SET NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      track INTEGER NOT NULL DEFAULT 0,
      layer_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,
},
```

- [ ] **Step 2: Add schema types and DB helpers**

Add interfaces:

```ts
export interface HypercutSuggestionSchema {
  id: string;
  job_id: string;
  source_type: "image" | "video" | "text" | "autocut_cut";
  asset_id: string | null;
  text_content: string | null;
  transcript_anchor_start: number;
  transcript_anchor_end: number;
  score: number | null;
  status: "pending" | "accepted" | "rejected";
  created_at: Date;
}

export interface HypercutClipSchema {
  id: string;
  job_id: string;
  suggestion_id: string | null;
  start_time: number;
  end_time: number;
  track: number;
  layer_data: string;
  created_at: Date;
}
```

Add namespace inside `DB`:

```ts
export namespace Hypercut {
  export async function insertSuggestion(suggestion: HypercutSuggestionSchema) {
    await db.insertInto("hypercut_suggestions").values(suggestion).execute();
    return suggestion;
  }

  export async function findSuggestionsByJob(jobId: string) {
    return await db
      .selectFrom("hypercut_suggestions")
      .where("job_id", "=", jobId)
      .orderBy("transcript_anchor_start", "asc")
      .selectAll()
      .execute();
  }

  export async function updateSuggestionStatus(
    id: string,
    status: HypercutSuggestionSchema["status"],
  ) {
    await db
      .updateTable("hypercut_suggestions")
      .set({ status })
      .where("id", "=", id)
      .execute();
  }

  export async function insertClip(clip: HypercutClipSchema) {
    await db.insertInto("hypercut_clips").values(clip).execute();
    return clip;
  }

  export async function findClipsByJob(jobId: string) {
    return await db
      .selectFrom("hypercut_clips")
      .where("job_id", "=", jobId)
      .orderBy("start_time", "asc")
      .selectAll()
      .execute();
  }

  export async function deleteClip(id: string) {
    await db.deleteFrom("hypercut_clips").where("id", "=", id).execute();
  }

  export async function updateClip(clip: HypercutClipSchema) {
    await db
      .updateTable("hypercut_clips")
      .set({
        start_time: clip.start_time,
        end_time: clip.end_time,
        track: clip.track,
        layer_data: clip.layer_data,
      })
      .where("id", "=", clip.id)
      .execute();
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts
git commit -m "feat: add hypercut_suggestions and hypercut_clips tables"
```

---

## Task 2: HyperCut transcript analyzer

**Files:**
- Create: `src/hypercut/hypercut-transcript-analyzer.ts`
- Test: `bun test src/hypercut/hypercut-transcript-analyzer.test.ts`

- [ ] **Step 1: Define timed transcript types**

```ts
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
```

- [ ] **Step 2: Implement filler word detection**

```ts
const FILLER_WORDS = new Set(["um", "uh", "ah", "mh", "hmm", "er", "erm"]);

export function detectFillers(words: TimedWord[]): RemovalSpan[] {
  const spans: RemovalSpan[] = [];
  for (const word of words) {
    const clean = word.word.toLowerCase().replace(/[^a-z]/g, "");
    if (FILLER_WORDS.has(clean)) {
      spans.push({
        start: word.start,
        end: word.end,
        text: word.word,
        reason: "filler",
      });
    }
  }
  return spans;
}
```

- [ ] **Step 3: Implement pause detection**

```ts
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
```

- [ ] **Step 4: Implement restart detection (simple heuristic)**

```ts
export function detectRestarts(words: TimedWord[]): RemovalSpan[] {
  const spans: RemovalSpan[] = [];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1].word.toLowerCase().replace(/[^a-z]/g, "");
    const curr = words[i].word.toLowerCase().replace(/[^a-z]/g, "");
    if (prev && prev === curr) {
      spans.push({
        start: words[i - 1].start,
        end: words[i].end,
        text: `${words[i - 1].word} ${words[i].word}`,
        reason: "restart",
      });
    }
  }
  return spans;
}
```

- [ ] **Step 5: Write tests**

Create `src/hypercut/hypercut-transcript-analyzer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  detectFillers,
  detectPauses,
  detectRestarts,
} from "./hypercut-transcript-analyzer";

describe("detectFillers", () => {
  test("finds um and uh", () => {
    const words = [
      { word: "um", start: 0.1, end: 0.3 },
      { word: "hello", start: 0.4, end: 0.8 },
    ];
    expect(detectFillers(words)).toHaveLength(1);
    expect(detectFillers(words)[0].reason).toBe("filler");
  });
});

describe("detectPauses", () => {
  test("finds long gaps", () => {
    const words = [
      { word: "a", start: 0, end: 0.2 },
      { word: "b", start: 2.0, end: 2.2 },
    ];
    expect(detectPauses(words)).toHaveLength(1);
    expect(detectPauses(words)[0].reason).toBe("pause");
  });
});
```

- [ ] **Step 6: Run tests**

Run: `bun test src/hypercut/hypercut-transcript-analyzer.test.ts`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/hypercut/
git commit -m "feat: add HyperCut transcript analyzer for fillers, pauses, restarts"
```

---

## Task 3: Parse WhisperX JSON into timed words

**Files:**
- Create: `src/hypercut/whisperx-parser.ts`
- Test: `bun test src/hypercut/whisperx-parser.test.ts`

- [ ] **Step 1: Read WhisperX JSON structure**

WhisperX output JSON has `segments[].words[]` with `word`, `start`, `end`.

- [ ] **Step 2: Implement parser**

```ts
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

export function parseWhisperX(jsonPath: string): TimedWord[] {
  const data = (await Bun.file(jsonPath).json()) as WhisperXTranscript;
  const words: TimedWord[] = [];
  for (const segment of data.segments ?? []) {
    for (const w of segment.words ?? []) {
      if (w.word && w.start !== undefined && w.end !== undefined) {
        words.push({ word: w.word.trim(), start: w.start, end: w.end });
      }
    }
  }
  return words;
}
```

- [ ] **Step 3: Test parser**

```ts
import { describe, expect, test } from "bun:test";
import { parseWhisperX } from "./whisperx-parser";

describe("parseWhisperX", () => {
  test("reads timed words from JSON file", async () => {
    const path = "/tmp/test-whisperx.json";
    await Bun.write(
      path,
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
    const words = await parseWhisperX(path);
    expect(words).toHaveLength(2);
    expect(words[0].word).toBe("hello");
  });
});
```

- [ ] **Step 4: Run tests and commit**

Run: `bun test src/hypercut/whisperx-parser.test.ts`
Expected: pass

```bash
git add src/hypercut/
git commit -m "feat: parse WhisperX JSON into timed words"
```

---

## Task 4: MCP-video client wrapper

**Files:**
- Create: `src/mcp/mcp-video.ts`
- Modify: `package.json`
- Modify: `src/main.ts`

- [ ] **Step 1: Add MCP-video package script**

In `package.json`, add:

```json
"mcp-video": "uvx --from mcp-video mcp-video"
```

- [ ] **Step 2: Create client wrapper**

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Logger } from "../logger/logger";

export namespace MCPVideo {
  let client: Client | null = null;

  export async function init() {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["run", "mcp-video"],
    });

    client = new Client({ name: "silicon-seeds", version: "0.1.0" });
    await client.connect(transport);
    Logger.info("MCP-video connected");
  }

  export async function callTool(name: string, args: Record<string, unknown>) {
    if (!client) throw new Error("MCP-video not initialized");
    return await client.callTool({ name, arguments: args });
  }

  export async function hyperframesInit(projectPath: string) {
    return callTool("hyperframes_init", { project_path: projectPath });
  }

  export async function hyperframesRender(projectPath: string, outputPath: string) {
    return callTool("hyperframes_render", {
      project_path: projectPath,
      output_path: outputPath,
    });
  }
}
```

- [ ] **Step 3: Initialize in main.ts**

In `src/main.ts`, after other inits:

```ts
import { MCPVideo } from "./mcp/mcp-video";
// ...
await MCPVideo.init();
```

- [ ] **Step 4: Typecheck and commit**

Run: `bunx tsc --noEmit`
Expected: no errors

```bash
git add src/mcp/mcp-video.ts src/main.ts package.json
git commit -m "feat: add MCP-video client wrapper"
```

---

## Task 5: HyperCut workflow orchestration

**Files:**
- Create: `src/hypercut/hypercut-workflow.ts`
- Modify: `src/jobs/jobs.ts` if needed
- Modify: `src/db/db.ts`

- [ ] **Step 1: Define job creation and upload handler**

```ts
import { JobOrchestrator } from "../jobs/jobs";
import { DB } from "../db/db";
import { WhisperX } from "../whisperx/whisperx";
import { parseWhisperX } from "./whisperx-parser";
import {
  detectFillers,
  detectPauses,
  detectRestarts,
} from "./hypercut-transcript-analyzer";
import { Logger } from "../logger/logger";

export namespace HyperCutWorkflow {
  export async function createJob(input: {
    original_prompt?: string;
    resolution?: string;
    video_model?: string;
  }) {
    return await JobOrchestrator.create_job({
      mode: "hypercut",
      ...input,
    });
  }

  export async function processUpload(jobId: string, videoPath: string) {
    const whisperJsonPath = await WhisperX.run(videoPath);
    const words = await parseWhisperX(whisperJsonPath);

    const removals = [
      ...detectFillers(words),
      ...detectPauses(words),
      ...detectRestarts(words),
    ];

    for (const span of removals) {
      await DB.Hypercut.insertSuggestion({
        id: crypto.randomUUID(),
        job_id: jobId,
        source_type: "autocut_cut",
        asset_id: null,
        text_content: span.text,
        transcript_anchor_start: span.start,
        transcript_anchor_end: span.end,
        score: null,
        status: "pending",
        created_at: new Date(),
      });
    }

    Logger.info("HyperCut removals stored", {
      jobId,
      count: removals.length,
    });

    // TODO: Trigger ChromaDB content suggestion generation in Task 6

    return removals.length;
  }
}
```

- [ ] **Step 2: Add ChromaDB suggestion generation**

In `src/hypercut/hypercut-workflow.ts`, add:

```ts
import { Chroma } from "../chroma/chroma";
import { LLM } from "../llm/llm";

export async function generateContentSuggestions(jobId: string, words: TimedWord[]) {
  const segments = groupWordsIntoSegments(words, 20);
  for (const segment of segments) {
    const queryText = await summarizeSegment(segment);
    const results = await Chroma.search(queryText, 3);
    for (const result of results) {
      await DB.Hypercut.insertSuggestion({
        id: crypto.randomUUID(),
        job_id: jobId,
        source_type: result.type as "image" | "video" | "text",
        asset_id: result.id,
        text_content: null,
        transcript_anchor_start: segment[0]?.start ?? 0,
        transcript_anchor_end: segment[segment.length - 1]?.end ?? 0,
        score: result.score ?? 0,
        status: "pending",
        created_at: new Date(),
      });
    }
  }
}

function groupWordsIntoSegments(words: TimedWord[], maxWords: number): TimedWord[][] {
  const segments: TimedWord[][] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords));
  }
  return segments;
}

async function summarizeSegment(words: TimedWord[]): Promise<string> {
  const text = words.map((w) => w.word).join(" ");
  const res = await LLM.message(
    `Summarize this video transcript segment in one sentence suitable for searching a visual content library. Only return the search query.\n\n${text}`,
  );
  return res?.content?.trim() ?? text;
}
```

- [ ] **Step 3: Add render function**

```ts
import { MCPVideo } from "../mcp/mcp-video";
import path from "node:path";

export async function render(jobId: string, outputDir: string) {
  const clips = await DB.Hypercut.findClipsByJob(jobId);
  const projectPath = path.join(outputDir, `hypercut-${jobId}.json`);

  // Build minimal Hyperframes project JSON from clips
  const project = buildHyperframesProject(clips);
  await Bun.write(projectPath, JSON.stringify(project, null, 2));

  const outputPath = path.join(outputDir, `hypercut-${jobId}.mp4`);
  await MCPVideo.hyperframesRender(projectPath, outputPath);

  return outputPath;
}

function buildHyperframesProject(clips: HypercutClipSchema[]) {
  return {
    version: "1.0",
    timeline: clips.map((clip) => ({
      ...JSON.parse(clip.layer_data),
      start: clip.start_time,
      end: clip.end_time,
      track: clip.track,
    })),
  };
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `bunx tsc --noEmit`
Expected: no errors

```bash
git add src/hypercut/hypercut-workflow.ts
git commit -m "feat: add HyperCut workflow orchestration"
```

---

## Task 6: ChromaDB search support

**Files:**
- Modify: `src/chroma/chroma.ts`

- [ ] **Step 1: Add search method**

```ts
export async function search(query: string, limit = 5) {
  if (!isReady()) await init();
  const embedding = await LLM.generateEmbedding(query);
  const results = await collection!.query({
    queryEmbeddings: [embedding],
    nResults: limit,
    include: ["metadatas", "distances"],
  });

  const ids = results.ids[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return ids.map((id, i) => ({
    id,
    score: distances[i] ?? 0,
    type: (metadatas[i]?.type as string) ?? "unknown",
  }));
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `bunx tsc --noEmit`

```bash
git add src/chroma/chroma.ts
git commit -m "feat: add ChromaDB semantic search"
```

---

## Task 7: API routes for HyperCut

**Files:**
- Create: `src/api/api/hypercut.ts`
- Modify: `src/api/api/index.ts`
- Modify: `src/api/schemas.ts`

- [ ] **Step 1: Add schema**

In `src/api/schemas.ts`:

```ts
export const PostHypercutSchema = z.object({
  prompt: z.string().optional(),
  resolution: z.string().max(7).optional(),
  video_model: z.string().max(50).optional(),
  video_file: z.instanceof(File),
});

export type PostHypercut = z.infer<typeof PostHypercutSchema>;
```

- [ ] **Step 2: Create API routes**

Create `src/api/api/hypercut.ts`:

```ts
import { z } from "zod";
import { HyperCutWorkflow } from "../../hypercut/hypercut-workflow";
import { DB } from "../../db/db";
import { Utils } from "../../utils/utils";
import { PostHypercutSchema } from "../schemas";

export async function post_hypercut(formData: FormData) {
  const parsed = PostHypercutSchema.safeParse({
    prompt: formData.get("prompt"),
    resolution: formData.get("resolution"),
    video_model: formData.get("video_model"),
    video_file: formData.get("video_file"),
  });

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { video_file, ...options } = parsed.data;
  const job = await HyperCutWorkflow.createJob(options);

  const videoPath = `${Bun.env.INPUT_DIR}/${job.id}-${video_file.name}`;
  await Bun.write(videoPath, await video_file.arrayBuffer());

  // Kick off async workflow
  void HyperCutWorkflow.processUpload(job.id, videoPath).catch((err) => {
    console.error("HyperCut workflow failed", err);
    void DB.Jobs.failJob(job.id);
  });

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/hypercut?show_progress=true&job_id=${job.id}`,
    },
  });
}

export async function get_suggestions(jobId: string) {
  const suggestions = await DB.Hypercut.findSuggestionsByJob(jobId);
  return Response.json({ suggestions });
}

export async function accept_suggestion(id: string) {
  await DB.Hypercut.updateSuggestionStatus(id, "accepted");
  return new Response(null, { status: 204 });
}

export async function reject_suggestion(id: string) {
  await DB.Hypercut.updateSuggestionStatus(id, "rejected");
  return new Response(null, { status: 204 });
}

export async function add_clip(body: {
  job_id: string;
  suggestion_id?: string;
  start_time: number;
  end_time: number;
  track: number;
  layer_data: Record<string, unknown>;
}) {
  const clip = await DB.Hypercut.insertClip({
    id: crypto.randomUUID(),
    job_id: body.job_id,
    suggestion_id: body.suggestion_id ?? null,
    start_time: body.start_time,
    end_time: body.end_time,
    track: body.track,
    layer_data: JSON.stringify(body.layer_data),
    created_at: new Date(),
  });
  return Response.json({ clip });
}
```

- [ ] **Step 3: Register routes**

In `src/api/api/index.ts`, add:

```ts
import {
  post_hypercut,
  get_suggestions,
  accept_suggestion,
  reject_suggestion,
  add_clip,
} from "./hypercut";

apiRoutes.post("/jobs/hypercut", async (c) => {
  const formData = await c.req.formData();
  return post_hypercut(formData);
});

apiRoutes.get("/jobs/hypercut/:job_id/suggestions", async (c) => {
  return get_suggestions(c.req.param("job_id"));
});

apiRoutes.post("/jobs/hypercut/suggestions/:id/accept", async (c) => {
  return accept_suggestion(c.req.param("id"));
});

apiRoutes.post("/jobs/hypercut/suggestions/:id/reject", async (c) => {
  return reject_suggestion(c.req.param("id"));
});

apiRoutes.post("/jobs/hypercut/clips", async (c) => {
  const body = await c.req.json();
  return add_clip(body);
});
```

- [ ] **Step 4: Typecheck and commit**

Run: `bunx tsc --noEmit`

```bash
git add src/api/api/hypercut.ts src/api/api/index.ts src/api/schemas.ts
git commit -m "feat: add HyperCut API routes"
```

---

## Task 8: React island for Hyperframes Studio

**Files:**
- Create: `src/hypercut/hyperframes-island.tsx`
- Create: `src/templates/hypercut-island.html` (mount point)
- Modify: `package.json`
- Modify: `src/api/api.tsx` or static serving

This task is intentionally lightweight for the MVP. A full React build pipeline is out of scope for the initial plan. We provide a minimal island that renders the timeline state and posts changes back to HTMX endpoints.

- [ ] **Step 1: Add React build step**

In `package.json`, add:

```json
"build:hyperframes-island": "bun build src/hypercut/hyperframes-island.tsx --outdir static/js --target browser",
"watch:hyperframes-island": "bun build src/hypercut/hyperframes-island.tsx --outdir static/js --target browser --watch"
```

- [ ] **Step 2: Create minimal React island**

```tsx
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface TimelineClip {
  id: string;
  start: number;
  end: number;
  track: number;
  label: string;
}

interface Props {
  jobId: string;
  sourceVideoUrl: string;
  clips: TimelineClip[];
}

function HyperframesIsland({ jobId, sourceVideoUrl, clips }: Props) {
  const [timeline, setTimeline] = useState(clips);

  async function addClip(suggestionId: string, start: number, end: number) {
    const res = await fetch("/api/jobs/hypercut/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        suggestion_id: suggestionId,
        start_time: start,
        end_time: end,
        track: 1,
        layer_data: { type: "media", src: suggestionId },
      }),
    });
    const data = await res.json();
    setTimeline((prev) => [...prev, data.clip]);
  }

  return (
    <div className="hyperframes-island border rounded p-4">
      <video src={sourceVideoUrl} controls className="w-full mb-4" />
      <div className="timeline-tracks">
        {timeline.map((clip) => (
          <div
            key={clip.id}
            className="clip badge badge-primary"
            style={{ marginLeft: `${clip.start * 10}px`, width: `${(clip.end - clip.start) * 10}px` }}
          >
            {clip.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const mount = document.getElementById("hyperframes-island");
if (mount) {
  const props = JSON.parse(mount.dataset.props ?? "{}");
  const root = createRoot(mount);
  root.render(<HyperframesIsland {...props} />);
}
```

- [ ] **Step 3: Build island**

Run: `bun run build:hyperframes-island`
Expected: `static/js/hyperframes-island.js` created

- [ ] **Step 4: Commit**

```bash
git add src/hypercut/hyperframes-island.tsx package.json static/js/
git commit -m "feat: add Hyperframes Studio React island (minimal MVP)"
```

---

## Task 9: HTMX page templates

**Files:**
- Create: `src/templates/hypercut.tsx`
- Create: `src/templates/hypercut-suggestions.tsx`
- Modify: `src/templates/templates.ts`
- Modify: `src/templates/app.tsx` (sidebar nav)
- Create: `src/api/create/hypercut.tsx`
- Modify: `src/api/create/index.ts`

- [ ] **Step 1: Create upload form template**

Create `src/templates/hypercut.tsx`:

```tsx
import { Templates } from "./templates";

const { Layout, App } = Templates;

export function HypercutPage() {
  return (
    <Layout>
      <App page="hypercut">
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">HyperCut</h1>
          <form
            hx-post="/api/jobs/hypercut"
            hx-encoding="multipart/form-data"
            hx-target="#hypercut-result"
          >
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Upload source video</legend>
              <input
                type="file"
                name="video_file"
                accept="video/*"
                className="file-input"
                required
              />
            </fieldset>
            <button type="submit" className="btn btn-primary mt-4">
              Start HyperCut
            </button>
          </form>
          <div id="hypercut-result" className="mt-4" />
        </div>
      </App>
    </Layout>
  );
}

export function HypercutWorkspace(props: {
  jobId: string;
  sourceVideoUrl: string;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      <div className="col-span-8">
        <div
          id="hyperframes-island"
          data-props={JSON.stringify(props)}
          className="min-h-[400px] border rounded bg-base-200"
        />
      </div>
      <div className="col-span-4">
        <div
          id="hypercut-suggestions"
          hx-get={`/create/hypercut/suggestions?job_id=${props.jobId}`}
          hx-trigger="load delay:2s, every 5s"
          hx-swap="innerHTML"
        >
          <span className="loading loading-spinner loading-sm" /> Loading suggestions...
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create suggestions fragment**

Create `src/templates/hypercut-suggestions.tsx`:

```tsx
import type { HypercutSuggestionSchema } from "../db/db";

export function HypercutSuggestions(props: {
  jobId: string;
  suggestions: HypercutSuggestionSchema[];
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Suggestions</h2>
      {props.suggestions.length === 0 && (
        <p className="text-sm opacity-70">No suggestions yet.</p>
      )}
      {props.suggestions.map((s) => (
        <div
          key={s.id}
          className={`card card-compact ${
            s.source_type === "autocut_cut" ? "bg-error/10" : "bg-base-100"
          } shadow-sm`}
        >
          <div className="card-body">
            <div className="flex justify-between items-start">
              <div>
                <span className="badge badge-sm">{s.source_type}</span>
                <p className="text-sm mt-1">{s.text_content ?? s.asset_id}</p>
                <p className="text-xs opacity-60">
                  {s.transcript_anchor_start.toFixed(2)}s - {s.transcript_anchor_end.toFixed(2)}s
                </p>
              </div>
              <div className="card-actions">
                <button
                  className="btn btn-xs btn-success"
                  hx-post={`/api/jobs/hypercut/suggestions/${s.id}/accept`}
                  hx-swap="none"
                >
                  Add
                </button>
                <button
                  className="btn btn-xs btn-ghost"
                  hx-post={`/api/jobs/hypercut/suggestions/${s.id}/reject`}
                  hx-swap="none"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Register templates**

In `src/templates/templates.ts`, add:

```ts
export { HypercutPage, HypercutWorkspace, HypercutSuggestions } from "./hypercut";
```

Move `HypercutSuggestions` to `src/templates/hypercut-suggestions.tsx` if preferred.

- [ ] **Step 4: Add sidebar nav link**

In `src/templates/app.tsx`, add a HyperCut menu item next to AutoCut.

- [ ] **Step 5: Create create routes**

Create `src/api/create/hypercut.tsx`:

```tsx
import { HypercutPage, HypercutWorkspace, HypercutSuggestions } from "../../templates/hypercut";
import { DB } from "../../db/db";
import { Api } from "../api";

export function registerHypercutRoutes(app: Hono) {
  app.get("/create/hypercut", async (c) => {
    const jobId = c.req.query("job_id");
    if (!jobId) {
      return Api.renderFragment(c, HypercutPage, "hypercut");
    }
    return Api.renderFragment(c, () => (
      <HypercutWorkspace jobId={jobId} sourceVideoUrl={`/assets/source/${jobId}`} />
    ), "hypercut");
  });

  app.get("/create/hypercut/suggestions", async (c) => {
    const jobId = c.req.query("job_id");
    if (!jobId) return c.text("Missing job_id", 400);
    const suggestions = await DB.Hypercut.findSuggestionsByJob(jobId);
    return Api.renderFragment(c, () => (
      <HypercutSuggestions jobId={jobId} suggestions={suggestions} />
    ));
  });
}
```

Register in `src/api/create/index.ts`.

- [ ] **Step 6: Typecheck and commit**

Run: `bunx tsc --noEmit`

```bash
git add src/templates/hypercut.tsx src/templates/hypercut-suggestions.tsx src/templates/templates.ts src/templates/app.tsx src/api/create/hypercut.tsx src/api/create/index.ts
git commit -m "feat: add HyperCut HTMX page templates"
```

---

## Task 10: Serve source video assets

**Files:**
- Modify: `src/api/api.tsx`

- [ ] **Step 1: Add source video serving route**

Add before `app.notFound`:

```ts
app.get("/assets/source/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await DB.Jobs.findById(jobId);
  if (!job || !job.source_video_path) return c.text("Not found", 404);
  const file = Bun.file(job.source_video_path);
  if (!(await file.exists())) return c.text("Not found", 404);
  return c.body(await file.arrayBuffer(), 200, {
    "Content-Type": "video/mp4",
  });
});
```

- [ ] **Step 2: Store source video path on job**

Modify `src/jobs/jobs.ts` `create_job` to accept and store `source_video_path` if needed, or store it in `hypercut_workflow.ts` via a DB update. Simpler: add `source_video_path` to jobs table via migration.

Add migration in `src/db/db.ts`:

```ts
{
  name: "add_job_source_video_path",
  sql: `ALTER TABLE jobs ADD COLUMN source_video_path TEXT;`,
},
```

Update `create_job` input type and `HyperCutWorkflow.createJob` to store it.

- [ ] **Step 3: Typecheck and commit**

Run: `bunx tsc --noEmit`

```bash
git add src/api/api.tsx src/db/db.ts src/jobs/jobs.ts
git commit -m "feat: serve HyperCut source video assets"
```

---

## Task 11: End-to-end wiring and startup

**Files:**
- Modify: `src/main.ts`
- Modify: `package.json`

- [ ] **Step 1: Initialize HyperCut and MCP-video in main**

```ts
import { MCPVideo } from "./mcp/mcp-video";
// ...
await MCPVideo.init();
```

- [ ] **Step 2: Build island on start**

In `package.json` `start:hot` or a new `build` script, ensure island is built. For dev, run in parallel:

```json
"start:hypercut": "bun run build:hyperframes-island && bun --hot src/main.ts",
```

- [ ] **Step 3: Typecheck and commit**

Run: `bunx tsc --noEmit`

```bash
git add src/main.ts package.json
git commit -m "chore: wire HyperCut and MCP-video into startup"
```

---

## Task 12: Verification

**Files:** all

- [ ] **Step 1: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run tests**

Run: `bun test src/hypercut/`
Expected: all pass

- [ ] **Step 3: Start dev server**

Run: `bun run build:hyperframes-island && bun --hot src/main.ts`
Expected: server starts, no crashes

- [ ] **Step 4: Test upload flow**

Use curl or browser to POST to `/api/jobs/hypercut` with a small video file.
Expected: job created, redirect returned

- [ ] **Step 5: Verify suggestions appear**

Visit `/create/hypercut?job_id=<id>` after WhisperX completes.
Expected: autocut_cut suggestions appear in suggestions panel

- [ ] **Step 6: Commit any fixes**

```bash
git add .
git commit -m "fix: verification fixes"
```

---

## Plan Coverage Check

| Spec requirement | Task |
|---|---|
| Upload video | Task 7 |
| WhisperX transcription | Task 5 |
| Autocut removal suggestions (independent) | Task 2, 3, 5 |
| Content suggestions from ChromaDB | Task 5, 6 |
| User-driven timeline | Task 8, 9 |
| Hyperframes Studio React island | Task 8 |
| MCP-video integration | Task 4 |
| Render final composition | Task 5 |
| SSE updates | Task 9 (polling for MVP) |
| Decoupled from AutoCut | Task 2, 3, 5 (no imports from `src/autocut/`) |
