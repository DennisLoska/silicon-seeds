import { Kysely } from "kysely";
import type { DbSchema } from "./db";
import { Metadata } from "../meta/meta";

export async function createTables(db: Kysely<DbSchema>): Promise<void> {
  await db.schema.dropTable("jobs").execute();
  await db.schema.dropTable("events").execute();
  await db.schema.dropTable("meta").execute();

  await db.schema
    .createTable("jobs")
    .ifNotExists()
    .addColumn("id", "text", (col) =>
      col.primaryKey().defaultTo(Metadata.randomId()),
    )
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(new Date().toISOString()),
    )
    .execute();

  await db.schema
    .createTable("events")
    .ifNotExists()
    .addColumn("id", "text", (col) =>
      col.primaryKey().defaultTo(Metadata.randomId()),
    )
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
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(new Date().toISOString()),
    )
    .execute();

  await db.schema
    .createTable("meta")
    .ifNotExists()
    .addColumn("id", "text", (col) =>
      col.primaryKey().defaultTo(Metadata.randomId()),
    )
    .addColumn("event_id", "text", (col) =>
      col.notNull().references("events.id"),
    )
    .addColumn("filename", "text", (col) => col.notNull())
    .addColumn("subfolder", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_events_job_id")
    .on("events")
    .column("job_id")
    .ifNotExists()
    .execute();
}
