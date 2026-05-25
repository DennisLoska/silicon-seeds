import { Kysely, sql } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const existingTableNames = tables.map((table) => table.name);

  if (!existingTableNames.includes("autocut_cut_clips")) {
    await db.schema
      .createTable("autocut_cut_clips")
      .addColumn("id", "text", (col) => col.primaryKey().notNull())
      .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .addColumn("job_id", "text", (col) => col.notNull().references("jobs.id"))
      .addColumn("clip_index", "integer", (col) => col.notNull())
      .addColumn("start_seconds", "real", (col) => col.notNull())
      .addColumn("end_seconds", "real", (col) => col.notNull())
      .addColumn("duration_seconds", "real", (col) => col.notNull())
      .addColumn("reasons", "text", (col) => col.notNull())
      .addColumn("transcript_text", "text", (col) => col.notNull())
      .addColumn("filename", "text", (col) => col.notNull())
      .addColumn("subfolder", "text", (col) => col.notNull())
      .execute();

    await db.schema
      .createIndex("idx_autocut_cut_clips_job_id")
      .on("autocut_cut_clips")
      .columns(["job_id", "clip_index"])
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const existingTableNames = tables.map((table) => table.name);

  if (existingTableNames.includes("autocut_cut_clips")) {
    await db.schema.dropTable("autocut_cut_clips").execute();
  }
}
