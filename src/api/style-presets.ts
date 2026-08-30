import { Hono } from "hono";
import { DB } from "../db/db";
import { zValidator } from "@hono/zod-validator";
import z from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional().nullable(),
  primary_style: z.string().min(1).max(50),
  secondary_trigger: z.string().max(100).optional().nullable(),
  styles: z.array(z.string().min(1).max(1000)).min(0).max(100),
  texture: z.string().max(500).optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  primary_style: z.string().min(1).max(50).optional(),
  secondary_trigger: z.string().max(100).optional().nullable(),
  styles: z.array(z.string().min(1).max(1000)).min(0).max(100).optional(),
  texture: z.string().max(500).optional().nullable(),
});

const app = new Hono();

app.get("/", async (c) => {
  const list = await DB.StylePresets.list();
  const mapped = list.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    primary_style: r.primary_style,
    secondary_trigger: r.secondary_trigger,
    styles: JSON.parse(r.styles_json) as string[],
    texture: r.texture,
    created_at: r.created_at,
  }));
  return c.json({ presets: mapped });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await DB.StylePresets.findById(id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    primary_style: row.primary_style,
    secondary_trigger: row.secondary_trigger,
    styles: JSON.parse(row.styles_json),
    texture: row.texture,
    created_at: row.created_at,
  });
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const body = c.req.valid("json");
  const exists = await DB.StylePresets.findByName(body.name);
  if (exists) return c.json({ error: "name already exists" }, 409);
  const created = await DB.StylePresets.create({
    name: body.name,
    description: body.description ?? null,
    primary_style: body.primary_style,
    secondary_trigger: body.secondary_trigger ?? null,
    styles_json: JSON.stringify(body.styles),
    texture: body.texture ?? null,
  });
  if (!created) return c.json({ error: "create failed" }, 500);
  return c.json(created, 201);
});

app.put("/:id", zValidator("json", updateSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await DB.StylePresets.findById(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (body.name && body.name !== existing.name) {
    const dup = await DB.StylePresets.findByName(body.name);
    if (dup) return c.json({ error: "name already exists" }, 409);
  }
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.primary_style !== undefined) update.primary_style = body.primary_style;
  if (body.secondary_trigger !== undefined) update.secondary_trigger = body.secondary_trigger;
  if (body.styles !== undefined) update.styles_json = JSON.stringify(body.styles);
  if (body.texture !== undefined) update.texture = body.texture;
  const updated = await DB.StylePresets.update(id, update as any);
  return c.json(updated);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await DB.StylePresets.findById(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await DB.StylePresets.remove(id);
  return c.json({ ok: true });
});

export default app;
