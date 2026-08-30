import { Hono } from "hono";

const app = new Hono();

async function listLorasFromComfy(): Promise<string[]> {
  const base = Bun.env.COMFYUI_BASE_URL;
  if (!base) return [];
  const candidates = [
    `${base}/api/loras`,
    `${base}/loras`,
    `${base}/object_info`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data: any = await res.json();
      // /api/loras often returns array of strings or objects with name
      if (Array.isArray(data)) {
        const names = data.map((d: any) => (typeof d === "string" ? d : d.name ?? d.filename ?? "")).filter(Boolean);
        if (names.length) return names;
      }
      if (data && typeof data === "object" && Array.isArray((data as any).loras)) return (data as any).loras;
      // object_info case: try to extract LoraLoader nodes file list? not available
      if (data && typeof data === "object" && data.LoraLoader) {
        // object_info doesn't list files, can't infer
        continue;
      }
    } catch {}
  }
  // Fallback: try ComfyUI /view or filesystem via custom? return empty
  return [];
}

app.get("/loras", async (c) => {
  try {
    const loras = await listLorasFromComfy();
    return c.json({ loras });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

export default app;
