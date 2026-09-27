import { Hono } from "hono";
import { DB } from "../db/db";

const app = new Hono();

app.get("/", async (c) => {
  const map = await DB.Settings.getAll();
  return c.json(map);
});

app.get("/:key", async (c) => {
  const key = c.req.param("key");
  const val = await DB.Settings.get(key);
  if (val === null) return c.json({ error: "not found" }, 404);
  return c.json({ key, value: val });
});

app.put("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return c.json({ error: "invalid json" }, 400);
  const entries = body as Record<string, unknown>;
  // Support either {key,value} or {settings:{k:v}}
  if ("key" in entries && "value" in entries) {
    const k = String((entries as any).key);
    const v = String((entries as any).value);
    await DB.Settings.set(k, v);
    return c.json({ key: k, value: v });
  }
  const settings = (entries.settings ?? entries) as Record<string, unknown>;
  const toSet: Record<string, string> = {};
  for (const [k, v] of Object.entries(settings)) toSet[k] = String(v);
  await DB.Settings.setMany(toSet);
  return c.json(toSet);
});

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return c.json({ error: "invalid json" }, 400);
  const entries = body as Record<string, unknown>;
  if ("key" in entries && "value" in entries) {
    const k = String((entries as any).key);
    const v = String((entries as any).value);
    await DB.Settings.set(k, v);
    return c.json({ key: k, value: v });
  }
  const toSet: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) toSet[k] = String(v);
  await DB.Settings.setMany(toSet);
  return c.json(toSet);
});

export default app;
