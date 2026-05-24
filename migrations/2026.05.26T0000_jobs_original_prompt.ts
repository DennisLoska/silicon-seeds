import { Kysely } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("original_prompt")) {
    await db.schema.alterTable("jobs").addColumn("original_prompt", "text").execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("original_prompt")) {
    await db.schema.alterTable("jobs").dropColumn("original_prompt").execute();
  }
}
