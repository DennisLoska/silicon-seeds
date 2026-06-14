import { Kysely } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((table) => table.name === "jobs");
  const existingColumns = jobsTable?.columns.map((column) => column.name) ?? [];

  if (!existingColumns.includes("source_video_path")) {
    await db.schema
      .alterTable("jobs")
      .addColumn("source_video_path", "text")
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((table) => table.name === "jobs");
  const existingColumns = jobsTable?.columns.map((column) => column.name) ?? [];

  if (existingColumns.includes("source_video_path")) {
    await db.schema.alterTable("jobs").dropColumn("source_video_path").execute();
  }
}
