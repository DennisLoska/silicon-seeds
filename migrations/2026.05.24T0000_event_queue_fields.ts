import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const existingColumns = eventsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("priority")) {
    await db.schema
      .alterTable("events")
      .addColumn("priority", "integer", (col) => col.notNull().defaultTo(0))
      .execute();
  }

  if (!existingColumns.includes("claimed_at")) {
    await db.schema.alterTable("events").addColumn("claimed_at", "text").execute();
  }

  if (!existingColumns.includes("attempt_count")) {
    await db.schema
      .alterTable("events")
      .addColumn("attempt_count", "integer", (col) => col.notNull().defaultTo(0))
      .execute();
  }

  if (!existingColumns.includes("error")) {
    await db.schema.alterTable("events").addColumn("error", "text").execute();
  }

  const indexes = await db.introspection.getTables();
  void indexes;
  await db.schema
    .createIndex("idx_events_queue")
    .on("events")
    .columns(["status", "priority", "created_at"])
    .ifNotExists()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const existingColumns = eventsTable?.columns.map((c) => c.name) ?? [];

  await db.schema.dropIndex("idx_events_queue").ifExists().execute();

  if (existingColumns.includes("error")) {
    await db.schema.alterTable("events").dropColumn("error").execute();
  }

  if (existingColumns.includes("attempt_count")) {
    await db.schema.alterTable("events").dropColumn("attempt_count").execute();
  }

  if (existingColumns.includes("claimed_at")) {
    await db.schema.alterTable("events").dropColumn("claimed_at").execute();
  }

  if (existingColumns.includes("priority")) {
    await db.schema.alterTable("events").dropColumn("priority").execute();
  }
}
