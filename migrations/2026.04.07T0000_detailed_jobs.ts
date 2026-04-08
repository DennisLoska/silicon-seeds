import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");

  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  // integer works for both Postgres (as int4) and SQLite
  const columnsToAdd = [
    { name: "fps", type: "integer" },
    { name: "clip_duration", type: "integer" },
    { name: "transition_duration", type: "integer" },
    { name: "image_model", type: "text" },
    { name: "video_model", type: "text" },
    { name: "style_preset", type: "text" },
  ];

  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      await db.schema
        .alterTable("jobs")
        .addColumn(col.name, col.type as any)
        .execute();
    }
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  const columnsToDrop = [
    "fps",
    "clip_duration",
    "transition_duration",
    "image_model",
    "video_model",
    "style_preset",
  ];

  for (const colName of columnsToDrop) {
    if (existingColumns.includes(colName)) {
      await db.schema.alterTable("jobs").dropColumn(colName).execute();
    }
  }
}
