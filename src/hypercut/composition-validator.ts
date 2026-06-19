import { lintHyperframeHtml } from "@hyperframes/core";

export interface CompositionValidationFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
  fixHint?: string;
}

export interface CompositionValidationResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  findings: CompositionValidationFinding[];
  compositionId: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

function findRootComposition(html: string): { id: string; raw: string } | null {
  const re = /<([a-zA-Z]+)\b[^>]*\bdata-composition-id="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === "html") continue;
    return { id: m[2], raw: m[0] };
  }
  return null;
}

function readAttr(raw: string, name: string): string | null {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = raw.match(re);
  return m ? m[1] : null;
}

export async function validateCompositionHtml(
  html: string,
): Promise<CompositionValidationResult> {
  const findings: CompositionValidationFinding[] = [];
  let compositionId: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;

  const root = findRootComposition(html);
  if (!root) {
    findings.push({
      code: "missing_composition_id",
      severity: "error",
      message: "Root composition is missing data-composition-id. Add a stable data-composition-id to the entry composition wrapper.",
    });
  } else {
    compositionId = root.id;
    const w = readAttr(root.raw, "data-width");
    const h = readAttr(root.raw, "data-height");
    const d = readAttr(root.raw, "data-duration");
    if (!w) {
      findings.push({
        code: "missing_width",
        severity: "error",
        message: "Root composition is missing data-width. Set numeric data-width on the entry composition root.",
      });
    } else {
      width = Number(w);
    }
    if (!h) {
      findings.push({
        code: "missing_height",
        severity: "error",
        message: "Root composition is missing data-height. Set numeric data-height on the entry composition root.",
      });
    } else {
      height = Number(h);
    }
    if (!d) {
      findings.push({
        code: "missing_duration",
        severity: "error",
        message: "Root composition is missing data-duration. Set numeric data-duration (seconds) on the entry composition root.",
      });
    } else {
      duration = Number(d);
    }
  }

  const hasTimelineRegistration = /window\.__timelines\[/.test(html);
  if (!hasTimelineRegistration) {
    findings.push({
      code: "missing_timeline_registration",
      severity: "error",
      message: "Missing window.__timelines registration. Register each composition timeline on window.__timelines[compositionId].",
    });
  } else if (compositionId) {
    const re = new RegExp(`window\\.__timelines\\["${compositionId}"\\]`);
    if (!re.test(html)) {
      findings.push({
        code: "timeline_id_mismatch",
        severity: "error",
        message: `window.__timelines key does not match composition id "${compositionId}".`,
      });
    }
  }

  const hasGsapScript = /<script[^>]*src="[^"]*gsap[^"]*"[^>]*>/i.test(html);
  const hasInlineGsap = /gsap\.(timeline|to|from|fromTo|set)\s*\(/.test(html);
  if (hasInlineGsap && !hasGsapScript) {
    const hasInlinedBundle = /\/\*\s*inlined:.*gsap/i.test(html) || /\b_gsScope\b/.test(html);
    if (!hasInlinedBundle) {
      findings.push({
        code: "missing_gsap_script",
        severity: "error",
        message: "Composition uses GSAP but no GSAP script is loaded. Add <script src=\"https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js\"></script> before your animation script.",
      });
    }
  }

  const errorCount = findings.filter(f => f.severity === "error").length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount: 0,
    findings,
    compositionId,
    width,
    height,
    duration,
  };
}

export async function lintCompositionHtml(
  html: string,
): Promise<CompositionValidationResult> {
  const structural = await validateCompositionHtml(html);
  const lintResult = await lintHyperframeHtml(html);
  const lintFindings: CompositionValidationFinding[] = lintResult.findings.map(f => ({
    code: f.code,
    severity: f.severity as "error" | "warning",
    message: f.message,
    fixHint: f.fixHint,
  }));
  const merged = [...structural.findings, ...lintFindings];
  const dedup = new Map<string, CompositionValidationFinding>();
  for (const f of merged) {
    const key = `${f.code}|${f.severity}|${f.message}`;
    if (!dedup.has(key)) dedup.set(key, f);
  }
  const findings = [...dedup.values()];
  const errorCount = findings.filter(f => f.severity === "error").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    findings,
    compositionId: structural.compositionId,
    width: structural.width,
    height: structural.height,
    duration: structural.duration,
  };
}

export async function validateCompositionFile(
  compPath: string,
): Promise<CompositionValidationResult> {
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    return {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      findings: [{
        code: "missing_file",
        severity: "error",
        message: `Composition file not found: ${compPath}`,
      }],
      compositionId: null,
      width: null,
      height: null,
      duration: null,
    };
  }
  const html = await file.text();
  return validateCompositionHtml(html);
}
