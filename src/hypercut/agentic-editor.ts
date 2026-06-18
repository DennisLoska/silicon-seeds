import path from "node:path";
import { tool } from "@lmstudio/sdk";
import z from "zod/v3";
import { LLM } from "../llm/llm";
import { ChatLike } from "@lmstudio/sdk";
import { DB } from "../db/db";
import { Chroma } from "../chroma/chroma";
import { Logger } from "../logger/logger";
import { HyperCutWorkflow } from "./hypercut-workflow";

let systemPrompt = "";
let loaded = false;

async function loadAllSkills(): Promise<string> {
  const skillsDir = path.join(import.meta.dirname, "skills");

  const skillPaths: string[] = [
    // Domain skills
    "db-integration.md",
    "composition-editing.md",
    // HyperFrames core skills
    "hyperframes-core/SKILL.md",
    "hyperframes-core/minimal-composition.md",
    "hyperframes-core/data-attributes.md",
    "hyperframes-core/tracks-and-clips.md",
    "hyperframes-core/sub-compositions.md",
    "hyperframes-core/variables-and-media.md",
    "hyperframes-core/determinism-rules.md",
    "hyperframes-core/full-screen-motion.md",
    "hyperframes-core/composition-patterns.md",
    // HyperFrames ancillary skills
    "hyperframes-animation/SKILL.md",
    "hyperframes-creative/SKILL.md",
    "hyperframes-media/SKILL.md",
    "hyperframes-cli/SKILL.md",
    "hyperframes-registry/SKILL.md",
    "hyperframes/SKILL.md",
    // Domain-specific video skills
    "embedded-captions/SKILL.md",
    "faceless-explainer/SKILL.md",
    "general-video/SKILL.md",
    "graphic-overlays/SKILL.md",
    "motion-graphics/SKILL.md",
    "product-launch-video/SKILL.md",
    "website-to-video/SKILL.md",
    "pr-to-video/SKILL.md",
    "remotion-to-hyperframes/SKILL.md",
  ];

  const parts: string[] = [];

  for (const relPath of skillPaths) {
    const fullPath = path.join(skillsDir, relPath);
    try {
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        const content = await file.text();
        parts.push(`=== ${relPath} ===\n${content}`);
      }
    } catch {
      // silently skip missing files
    }
  }

  return parts.join("\n\n");
}

export async function initAgent(): Promise<void> {
  if (loaded) return;
  const skills = await loadAllSkills();
  systemPrompt = `You are an AI video editing assistant integrated into HyperCut, a video editing application. You help users edit their video compositions by modifying HTML composition files, searching their media library, and managing suggestions.

Available Skills (use these to guide your edits):
${skills}

CRITICAL RULES:
1. Always call read_composition first before editing - never assume you know the current state.
2. After making changes, always call write_composition to persist them. The UI auto-reloads.
3. When searching media, present the results to the user with clear descriptions.
4. For suggestions: get_suggestions lists AI-generated edits; ask user which they want before applying.
5. Be concise in your responses but thorough in your edits.
6. The source video is at track-index 1. Overlays go on tracks 2+.
7. Preserve existing elements in the composition unless the user asks to remove them.
8. If you need more information about a tool, ask the user. Don't guess.`;

  loaded = true;
}

function createTools(jobId: string, compositionEditedRef: { current: boolean }) {
  return [
    tool({
      name: "read_composition",
      description: "Read the current composition HTML for this job. Always call this first before making edits.",
      parameters: {
        jobId: z.string().describe("The job ID"),
      },
      implementation: async () => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
        const file = Bun.file(compPath);
        if (!(await file.exists())) return "Error: composition not found. Generate it first.";
        return await file.text();
      },
    }),

    tool({
      name: "write_composition",
      description: "Write a new composition HTML. This replaces the entire composition. Call this after editing.",
      parameters: {
        html: z.string().describe("The full HTML content of the composition"),
      },
      implementation: async (args: { html: string }) => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
        await Bun.write(compPath, args.html);
        compositionEditedRef.current = true;
        Logger.info("Agent: composition written", { jobId });
        return "Composition saved successfully. The studio will reload.";
      },
    }),

    tool({
      name: "search_media",
      description: "Semantic search of the media library. Returns matching images, videos, and audio files ranked by relevance.",
      parameters: {
        query: z.string().describe("Natural language search query describing the visual/audio content you want"),
        limit: z.number().optional().default(5).describe("Maximum number of results"),
      },
      implementation: async (args: { query: string; limit?: number }) => {
        const results = await Chroma.search(args.query, args.limit ?? 5);
        return JSON.stringify(results);
      },
    }),

    tool({
      name: "get_suggestions",
      description: "Get content suggestions for this job — additional media assets (images/video/text) from the content library that could be added to the composition.",
      parameters: {},
      implementation: async () => {
        const suggestions = await DB.Hypercut.findContentSuggestionsByJob(jobId);
        return JSON.stringify(suggestions);
      },
    }),

    tool({
      name: "accept_suggestion",
      description: "Mark a suggestion as accepted.",
      parameters: {
        suggestionId: z.string().describe("The suggestion ID to accept"),
      },
      implementation: async (args: { suggestionId: string }) => {
        await DB.Hypercut.updateSuggestionStatus(args.suggestionId, "accepted");
        return "Suggestion accepted.";
      },
    }),

    tool({
      name: "reject_suggestion",
      description: "Mark a suggestion as rejected.",
      parameters: {
        suggestionId: z.string().describe("The suggestion ID to reject"),
      },
      implementation: async (args: { suggestionId: string }) => {
        await DB.Hypercut.updateSuggestionStatus(args.suggestionId, "rejected");
        return "Suggestion rejected.";
      },
    }),

    tool({
      name: "get_transcript_words",
      description: "Get transcribed words from autocut suggestions (filler/pause detections). Each entry has word text + start/end timestamps.",
      parameters: {},
      implementation: async () => {
        const suggestions = await DB.Hypercut.findSuggestionsByJob(jobId);
        const words = suggestions
          .filter((s) => s.source_type === "autocut_cut" && s.text_content)
          .map((s) => ({
            word: s.text_content,
            start: s.transcript_anchor_start,
            end: s.transcript_anchor_end,
          }));
        return JSON.stringify(words.length > 0 ? words : "No transcript words available. Use get_suggestions for timing data.");
      },
    }),

    tool({
      name: "get_job_info",
      description: "Get job metadata: resolution, status, original_prompt.",
      parameters: {},
      implementation: async () => {
        const job = await DB.Jobs.findById(jobId);
        if (!job) return "Error: job not found";
        return JSON.stringify({
          id: job.id,
          resolution: job.resolution,
          status: job.status,
          original_prompt: job.original_prompt,
          source_video_path: job.source_video_path,
        });
      },
    }),
  ];
}

type HistoryMsg = { role: "system" | "user" | "assistant"; content: string };

const encoder = new TextEncoder();

const conversations = new Map<string, HistoryMsg[]>();
const MAX_HISTORY = 20;

function getOrCreateConversation(jobId: string): HistoryMsg[] {
  let history = conversations.get(jobId);
  if (!history) {
    history = [{ role: "system", content: systemPrompt }];
    conversations.set(jobId, history);
  }
  return history;
}

function trimHistory(history: HistoryMsg[]): void {
  if (history.length > MAX_HISTORY) {
    const systemMsg = history[0];
    const recent = history.slice(history.length - MAX_HISTORY + 1);
    history.length = 0;
    history.push(systemMsg, ...recent);
  }
}

export namespace AgenticEditor {
  export function clearHistory(jobId: string): void {
    conversations.delete(jobId);
  }

  export async function chatStream(
    jobId: string,
    message: string,
  ): Promise<Response> {
    await initAgent();

    const compositionEditedRef = { current: false };
    const agentTools = createTools(jobId, compositionEditedRef);
    const history: HistoryMsg[] = getOrCreateConversation(jobId);

    history.push({ role: "user", content: message });

    let finalText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventName: string, data: string) => {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`));
        };

        try {
          await LLM.model.act(history as ChatLike, agentTools, {
            maxTokens: 10_000,
            onPredictionFragment: (fragment: { content: string; roundIndex: number }) => {
              if (fragment.content) {
                finalText += fragment.content;
                sendEvent("token", JSON.stringify({ text: fragment.content }));
              }
            },
            onMessage: (msg: { toString(): string }) => {
              finalText = msg.toString();
            },
          });

          // Add assistant response to history
          history.push({ role: "assistant", content: finalText });
          trimHistory(history);

          sendEvent("done", JSON.stringify({
            text: finalText,
            compositionEdited: compositionEditedRef.current,
          }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          Logger.error("Agent: chat failed", { jobId, error: msg });
          sendEvent("error", JSON.stringify({ message: msg }));
          sendEvent("done", JSON.stringify({ text: "Error processing message", compositionEdited: compositionEditedRef.current }));
        } finally {
          try { controller.close(); } catch { /* ignore */ }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
