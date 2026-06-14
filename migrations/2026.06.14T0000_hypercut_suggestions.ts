import { Kysely, sql } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const existingTableNames = tables.map((table) => table.name);

  if (!existingTableNames.includes("hypercut_suggestions")) {
    await db.schema
      .createTable("hypercut_suggestions")
      .addColumn("id", "text", (col) => col.primaryKey().notNull())
      .addColumn("created_at", "text", (col) =>
        col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn("job_id", "text", (col) =>
        col.notNull().references("jobs.id").onDelete("cascade"),
      )
      .addColumn("source_type", "text", (col) => col.notNull())
      .addColumn("asset_id", "text", (col) =>
        col.references("meta.id").onDelete("set null"),
      )
      .addColumn("text_content", "text")
      .addColumn("transcript_anchor_start", "real", (col) => col.notNull())
      .addColumn("transcript_anchor_end", "real", (col) => col.notNull())
      .addColumn("score", "real")
      .addColumn("status", "text", (col) => col.notNull())
      .execute();

    await db.schema
      .createIndex("idx_hypercut_suggestions_job_id")
      .on("hypercut_suggestions")
      .columns(["job_id", "transcript_anchor_start"])
      .execute();
  }

  if (!existingTableNames.includes("hypercut_clips")) {
    await db.schema
      .createTable("hypercut_clips")
      .addColumn("id", "text", (col) => col.primaryKey().notNull())
      .addColumn("created_at", "text", (col) =>
        col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn("job_id", "text", (col) =>
        col.notNull().references("jobs.id").onDelete("cascade"),
      )
      .addColumn("suggestion_id", "text", (col) =>
        col.references("hypercut_suggestions.id").onDelete("set null"),
      )
      .addColumn("start_time", "real", (col) => col.notNull())
      .addColumn("end_time", "real", (col) => col.notNull())
      .addColumn("track", "integer", (col) => col.notNull())
      .addColumn("layer_data", "text", (col) => col.notNull())
      .execute();

    await db.schema
      .createIndex("idx_hypercut_clips_job_id")
      .on("hypercut_clips")
      .columns(["job_id", "start_time"])
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const existingTableNames = tables.map((table) => table.name);

  if (existingTableNames.includes("hypercut_clips")) {
    await db.schema.dropTable("hypercut_clips").execute();
  }

  if (existingTableNames.includes("hypercut_suggestions")) {
    await db.schema.dropTable("hypercut_suggestions").execute();
  }
}
