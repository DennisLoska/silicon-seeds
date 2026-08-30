import { Hono } from "hono";
import { DB } from "../db/db";
import { zValidator } from "@hono/zod-validator";
import z from "zod";

const createSchema = z.object({
  comfyui_name: z.string().min(1).max(200),
  display_name: z.string().min(1).max(200),
  trigger_word: z.string().max(100).optional().nullable(),
  is_active: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  comfyui_name: z.string().min(1).max(200).optional(),
  display_name: z.string().min(1).max(200).optional(),
  trigger_word: z.string().max(100).optional().nullable(),
  is_active: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const app = new Hono();

app.get("/", async (c) => {
  const list = await DB.Loras.list();
  return c.json({ loras: list });
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const existing = await DB.db.selectFrom("loras").selectAll().where("comfyui_name", "=", body.comfyui_name).executeTakeFirst();
  if (existing) return c.json({ error: "lora already exists" }, 409);
  const count = (await DB.Loras.list()).length;
  const created = await DB.Loras.create({
    comfyui_name: body.comfyui_name,
    display_name: body.display_name,
    trigger_word: body.trigger_word ?? null,
    is_active: body.is_active ?? 1,
    sort_order: body.sort_order ?? count,
  });
  return c.json(created, 201);
});

app.put("/reorder", zValidator("json", reorderSchema), async (c) => {
  const { ids } = c.req.valid("json");
  await DB.Loras.reorder(ids);
  const list = await DB.Loras.list();
  return c.json({ loras: list });
});

app.put("/:id", zValidator("json", updateSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const updated = await DB.Loras.update(id, body as any);
  return c.json(updated);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await DB.Loras.remove(id);
  return c.json({ ok: true });
});

app.post("/sync", async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const names: string[] = Array.isArray(body.names) ? body.names : Array.isArray(body.loras) ? body.loras : [];
  if (!Array.isArray(names) || names.length === 0) return c.json({ error: "names array required" }, 400);
  await DB.Loras.upsertMany(names);
  const list = await DB.Loras.list();
  return c.json({ loras: list, added: names.length });
});

export default app;
