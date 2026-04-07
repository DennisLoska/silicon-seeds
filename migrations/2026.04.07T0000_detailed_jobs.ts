import { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("jobs").addColumn("fps", "int2").execute();
  await db.schema
    .alterTable("jobs")
    .addColumn("clip_duration", "int2")
    .execute();
  await db.schema
    .alterTable("jobs")
    .addColumn("transition_duration", "int2")
    .execute();
  await db.schema.alterTable("jobs").addColumn("image_model", "text").execute();
  await db.schema.alterTable("jobs").addColumn("video_model", "text").execute();
  await db.schema
    .alterTable("jobs")
    .addColumn("style_preset", "text")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {}
