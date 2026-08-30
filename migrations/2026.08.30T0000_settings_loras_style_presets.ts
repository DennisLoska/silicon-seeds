import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("autocut_cut_clips").ifExists().execute();

  await db.schema
    .createTable("settings")
    .ifNotExists()
    .addColumn("key", "text", (col) => col.primaryKey().notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("style_presets")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("description", "text")
    .addColumn("primary_style", "text", (col) => col.notNull())
    .addColumn("secondary_trigger", "text")
    .addColumn("styles_json", "text", (col) => col.notNull())
    .addColumn("texture", "text")
    .addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createTable("loras")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("comfyui_name", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("trigger_word", "text")
    .addColumn("is_active", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("sort_order", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // Seed settings defaults
  const settings: Record<string, string> = {
    default_style_preset: "system",
    default_fps: "16",
    default_clip_duration: "5",
    default_transition_duration: "2",
    default_resolution: "720p",
    default_image_model: "z-image-turbo",
    default_video_model: "wan2.2",
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.insertInto("settings").values({ key: k, value: v }).onConflict((oc) => oc.column("key").doNothing()).execute();
  }

  // Seed style presets curated from mflux-forge
  const presets: Array<{ name: string; description: string; primary_style: string; secondary_trigger: string | null; styles: string[]; texture: string | null }> = [
    { name: "system", description: "Default — no extra style", primary_style: "default", secondary_trigger: null, styles: [], texture: null },
    { name: "watercolor", description: "Watercolor on cold-press paper", primary_style: "watercolor", secondary_trigger: null, styles: [
      "snowy alpine lake at dawn, peaks mirrored in still water, watercolor on cold-press paper, pale cerulean sky with variegated wash, wet-on-wet mist, tranquil",
      "lavender fields at sunset with distant farmhouse, watercolor on cold-press paper, warm alizarin glow, soft diffusion, romantic calm",
      "rocky coastline and crashing surf, watercolor on cold-press paper, cobalt teal + indigo sea, splatter foam, windswept mood",
      "mist forest of pines, gentle river S-curve, watercolor on cold-press, payne’s gray + sap green palette, quiet morning",
      "Tuscan hills and cypress road, watercolor on cold-press, golden ochre fields, ultramarine shadows, paper grain visible",
    ], texture: "subtle paper texture, tasteful white margins, minimalist, print-ready" },
    { name: "pencil_watercolor", description: "Pencil sketch + watercolor", primary_style: "watercolor", secondary_trigger: "pencil sketch", styles: [
      "snowy alpine lake at dawn, peaks mirrored in still water, watercolor on cold-press paper, pale cerulean sky, pencil sketch underdrawing, dry-brush details",
      "lavender fields at sunset, watercolor + pencil sketch texture, warm glow, soft diffusion",
    ], texture: "subtle paper texture, tasteful white margins, minimalist, print-ready" },
    { name: "oil_paint", description: "Thick impasto oil paint", primary_style: "oil_paint", secondary_trigger: null, styles: ["thick impasto brushstrokes, heavy oil paint texture, canvas grain, palette knife details, dramatic chiaroscuro, warm amber undertones"], texture: "thick impasto brushstrokes, heavy oil paint texture, canvas grain, palette knife details" },
    { name: "charcoal", description: "Rough charcoal smudges", primary_style: "charcoal", secondary_trigger: null, styles: ["rough charcoal smudges, heavy grit, hand-drawn graphite texture, high-contrast shading, expressive gestural strokes"], texture: "rough charcoal smudges, heavy grit, hand-drawn graphite texture, high-contrast shading" },
    { name: "cyberpunk", description: "Holographic neon cyberpunk", primary_style: "cyberpunk", secondary_trigger: null, styles: ["holographic glitch, iridescent foil, glowing circuitry, neon-infused brushed metal, vaporwave city"], texture: "holographic glitch, iridescent foil, glowing circuitry, neon-infused brushed metal" },
    { name: "etching", description: "Vintage copperplate engraving", primary_style: "etching", secondary_trigger: null, styles: ["vintage 19th-century copperplate engraving, cross-hatching, ink on aged parchment, Gustave Doré inspired"], texture: "vintage 19th-century copperplate engraving, cross-hatching, ink on aged parchment" },
    { name: "watercolor_general", description: "Watercolor general variety", primary_style: "watercolor", secondary_trigger: null, styles: [
      "Watercolor painting of SCENE, wet-on-wet technique on cold-pressed paper, visible brushstrokes, muted ochre and sienna with gold leaf accents",
      "Loose watercolor sketch of SCENE, wet-on-dry technique, bold washes with hard edges, limited palette of burnt umber and indigo",
    ], texture: "wet-on-wet watercolor bleeds, granulated pigment, cold-press paper texture, soft edges" },
    { name: "anime", description: "Anime style", primary_style: "anime", secondary_trigger: "Anime-Z", styles: ["anime style, vibrant colors, sharp linework, studio ghibli inspired, expressive eyes"], texture: null },
    { name: "ghibli", description: "Ghibli style", primary_style: "ghibli", secondary_trigger: "ghibli", styles: ["ghibli style, soft painterly background, whimsical, hand-drawn animation aesthetic"], texture: null },
    { name: "pixel_art", description: "Pixel art", primary_style: "pixel_art", secondary_trigger: "Pixel art style.", styles: ["Pixel art style, 16-bit retro, crisp pixels, vibrant palette"], texture: null },
    { name: "concrete", description: "Brutalist concrete", primary_style: "concrete", secondary_trigger: null, styles: ["brutalist raw concrete, formwork impressions, gritty cement, industrial grey"], texture: "brutalist raw concrete, formwork impressions, gritty cement, industrial grey" },
    { name: "stained_glass", description: "Stained glass cathedral", primary_style: "stained_glass", secondary_trigger: null, styles: ["leaded glass fragments, vibrant kaleidoscopic colors, cathedral light, soldered joints"], texture: "leaded glass fragments, vibrant kaleidoscopic colors, cathedral light, soldered joints" },
    { name: "classic_painting", description: "Classic oil painting", primary_style: "classic_painting", secondary_trigger: "class1cpa1nt", styles: ["classic oil painting, renaissance master style, chiaroscuro lighting, museum quality"], texture: "thick impasto brushstrokes, heavy oil paint texture, canvas grain" },
  ];

  for (const p of presets) {
    const id = crypto.randomUUID();
    await db.insertInto("style_presets").values({
      id,
      name: p.name,
      description: p.description,
      primary_style: p.primary_style,
      secondary_trigger: p.secondary_trigger,
      styles_json: JSON.stringify(p.styles),
      texture: p.texture,
    }).onConflict((oc) => oc.column("name").doNothing()).execute();
  }

  // Index lora file placeholder
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("loras").ifExists().execute();
  await db.schema.dropTable("style_presets").ifExists().execute();
  await db.schema.dropTable("settings").ifExists().execute();
}
