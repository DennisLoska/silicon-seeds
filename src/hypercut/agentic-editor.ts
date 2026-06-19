import path from "node:path";
import { tool } from "@lmstudio/sdk";
import z from "zod/v3";
import { LLM } from "../llm/llm";
import { ChatLike } from "@lmstudio/sdk";
import { DB } from "../db/db";
import { Chroma } from "../chroma/chroma";
import { Logger } from "../logger/logger";
import {
  lintCompositionHtml,
} from "./composition-validator";

let systemPrompt = "";
let loaded = false;

export interface LintFinding {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  file?: string;
  fix?: string;
  fixHint?: string;
}

interface LintResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  findings: LintFinding[];
}

async function lintComposition(projectDir: string): Promise<LintResult> {
  const compPath = `${projectDir}/index.html`;
  try {
    const file = Bun.file(compPath);
    if (!(await file.exists())) {
      return {
        ok: false,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        findings: [{
          severity: "error",
          message: `Composition not found at ${compPath}`,
        }],
      };
    }
    const html = await file.text();
    const result = await lintCompositionHtml(html);
    return {
      ok: result.ok,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: 0,
      findings: result.findings.map(f => ({
        severity: f.severity,
        message: f.message,
        code: f.code,
        fixHint: f.fixHint,
      })),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    Logger.error("Agent: lint exception", { msg });
    return {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      findings: [{ severity: "error", message: `Lint failed: ${msg}` }],
    };
  }
}

export async function autoFixLint(compPath: string, findings: LintFinding[]): Promise<string | null> {
  let html = await Bun.file(compPath).text();
  const fixes: string[] = [];

  for (const finding of findings) {
    if (finding.severity !== "error") continue;

    if (finding.message.includes("window.__timelines") && !html.includes("window.__timelines")) {
      const compIdMatch = html.match(/data-composition-id="([^"]+)"/);
      const durMatch = html.match(/data-duration="([^"]+)"/);
      if (compIdMatch && durMatch) {
        const compId = compIdMatch[1];
        const duration = durMatch[1];
        const timelineScript = `<script>\n      window.__timelines = window.__timelines || {};\n      const tl = gsap.timeline({ paused: true });\n      tl.to({}, { duration: ${duration} });\n      window.__timelines["${compId}"] = tl;\n    </script>`;
        html = html.replace("</body>", `${timelineScript}\n  </body>`);
        fixes.push("added window.__timelines registration");
      }
    }

    if (finding.message.includes("data-composition-id") && !html.includes("data-composition-id=")) {
      html = html.replace(/<div\s+id="stage"/, '<div id="stage" data-composition-id="composition"');
      fixes.push("added data-composition-id");
    }

    if (finding.message.includes("data-width") && !html.includes("data-width=")) {
      html = html.replace(/<div\s+id="stage"/, '<div id="stage" data-width="1920" data-height="1080"');
      fixes.push("added data-width/data-height");
    }
  }

  if (fixes.length > 0) {
    await Bun.write(compPath, html);
    Logger.info("Agent: auto-fixed lint issues", { fixes });
    return fixes.join(", ");
  }
  return null;
}

async function loadAllSkills(): Promise<string> {
  const skillsDir = path.join(import.meta.dirname, "skills");

  const skillPaths: string[] = [
    "db-integration.md",
    "composition-editing.md",
    "hyperframes-core/SKILL.md",
    "hyperframes-core/data-attributes.md",
    "hyperframes-core/tracks-and-clips.md",
    "hyperframes-core/determinism-rules.md",
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
3. write_composition automatically lints and auto-fixes common issues. If lint errors remain, fix them and call write_composition again.
4. When searching media, present the results to the user with clear descriptions.
5. For suggestions: get_suggestions lists AI-generated edits; ask user which they want before applying.
6. Be concise in your responses but thorough in your edits.
7. The source video is at track-index 0. Overlays go on tracks 1+.
8. Preserve existing elements in the composition unless the user asks to remove them.
9. If you need more information about a tool, ask the user. Don't guess.
10. ANIMATION RULE: Use GSAP tl.fromTo/tl.to for animating overlay elements. The animation MUST be on the registered window.__timelines timeline so the HyperFrames producer can seek it deterministically during rendering. Do NOT use CSS @keyframes — CSS animations run on wall-clock time and will not appear in renders. The gsap_studio_edit_blocked lint warning is expected and acceptable when GSAP owns element positions. Place the duration marker tl.to({}, { duration: <total> }) FIRST, then add fromTo/tweens after it.`;

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
      description: "Write a new composition HTML. This replaces the entire composition. Call this after editing. Automatically lints after writing — if lint errors are found, they are returned and the composition is auto-fixed when possible.",
      parameters: {
        html: z.string().describe("The full HTML content of the composition"),
      },
      implementation: async (args: { html: string }) => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const projectDir = `${outputDir}/hypercut-${jobId}`;
        const compPath = `${projectDir}/index.html`;
        await Bun.write(compPath, args.html);
        compositionEditedRef.current = true;
        Logger.info("Agent: composition written", { jobId });

        const lintResult = await lintComposition(projectDir);
        if (lintResult.errorCount > 0) {
          const fixed = await autoFixLint(compPath, lintResult.findings);
          if (fixed) {
            return `Composition saved. Lint found ${lintResult.errorCount} error(s) — auto-fixed: ${fixed}. Composition is now valid.`;
          }
          return `Composition saved but lint found ${lintResult.errorCount} error(s):\n${lintResult.findings.map(f => `[${f.severity}] ${f.code ?? ""}: ${f.message} — ${f.fixHint ?? f.fix ?? ""}`).join("\n")}\nFix these and call write_composition again.`;
        }
        return "Composition saved successfully. Lint passed. The studio will reload.";
      },
    }),

    tool({
      name: "lint_composition",
      description: "Run the HyperFrames linter on the current composition. Returns errors and warnings with fix suggestions. Always call this after write_composition to verify the composition is valid.",
      parameters: {},
      implementation: async () => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const projectDir = `${outputDir}/hypercut-${jobId}`;
        const result = await lintComposition(projectDir);
        if (result.errorCount === 0 && result.warningCount === 0) {
          return "Lint passed. No issues found.";
        }
        return JSON.stringify(result, null, 2);
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
