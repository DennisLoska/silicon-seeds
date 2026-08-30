import { Hono } from "hono";

const app = new Hono();

async function listLorasFromComfy(): Promise<string[]> {
  const base = Bun.env.COMFYUI_BASE_URL;
  if (!base) return [];
  const candidates = [
    `${base}/api/models/loras`,
    `${base}/models/loras`,
    `${base}/api/experiment/models/loras`,
    `${base}/api/loras`,
    `${base}/loras`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data: any = await res.json();
      if (Array.isArray(data)) {
        // /api/models/loras returns string[] , experiment returns objects with name/filename
        const names = data
          .map((d: any) => {
            if (typeof d === "string") return d;
            return d.name ?? d.filename ?? d.path ?? "";
          })
          .filter(Boolean)
          .map((n: string) => n.split("/").pop() ?? n);
        if (names.length) return names;
      }
      if (data && typeof data === "object" && Array.isArray((data as any).loras)) return (data as any).loras;
    } catch {}
  }
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
