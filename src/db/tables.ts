import { Kysely } from "kysely";
import type { DbSchema } from "./client";

export async function createTables(db: Kysely<DbSchema>): Promise<void> {
  await db.schema
    .createTable("jobs")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("created_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("events")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("job_id", "text", (col) => col.notNull().references("jobs.id"))
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("mode", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("prompt", "text")
    .addColumn("filename", "text")
    .addColumn("start_img", "text")
    .addColumn("end_img", "text")
    .addColumn("duration", "integer")
    .addColumn("lora", "text")
    .addColumn("index", "integer")
    .addColumn("meta_data", "text")
    .addColumn("created_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_events_job_id")
    .on("events")
    .column("job_id")
    .ifNotExists()
    .execute();
}
