import { Kysely } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("style_guide")) {
    await db.schema
      .alterTable("jobs")
      .addColumn("style_guide", "text", (col) => col.defaultTo(null))
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("style_guide")) {
    await db.schema.alterTable("jobs").dropColumn("style_guide").execute();
  }
}
