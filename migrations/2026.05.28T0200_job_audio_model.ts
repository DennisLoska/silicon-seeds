import { Kysely } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("audio_model")) {
    await db.schema
      .alterTable("jobs")
      .addColumn("audio_model", "text", (col) => col.defaultTo(null))
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("audio_model")) {
    await db.schema.alterTable("jobs").dropColumn("audio_model").execute();
  }
}
