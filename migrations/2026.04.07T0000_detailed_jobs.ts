import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("jobs")
    .addColumn("fps", "int2", (col) => col.defaultTo(null))
    .addColumn("clip_duration", "int2", (col) => col.defaultTo(null))
    .addColumn("transition_duration", "int2", (col) => col.defaultTo(null))
    .addColumn("image_model", "text", (col) => col.defaultTo(null))
    .addColumn("video_model", "text", (col) => col.defaultTo(null))
    .addColumn("style_preset", "text", (col) => col.defaultTo(null))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {}
