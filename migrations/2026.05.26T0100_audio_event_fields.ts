import { Kysely } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const existingColumns = eventsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("lyrics")) {
    await db.schema.alterTable("events").addColumn("lyrics", "text").execute();
  }

  if (!existingColumns.includes("audio_settings")) {
    await db.schema
      .alterTable("events")
      .addColumn("audio_settings", "text")
      .execute();
  }
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const existingColumns = eventsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("audio_settings")) {
    await db.schema.alterTable("events").dropColumn("audio_settings").execute();
  }

  if (existingColumns.includes("lyrics")) {
    await db.schema.alterTable("events").dropColumn("lyrics").execute();
  }
}
