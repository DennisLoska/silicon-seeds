import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const columnExists = eventsTable?.columns.some((c) => c.name === "text");

  if (!columnExists) {
    await db.schema.alterTable("events").addColumn("text", "text").execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const eventsTable = tables.find((t) => t.name === "events");
  const columnExists = eventsTable?.columns.some((c) => c.name === "text");

  if (columnExists) {
    await db.schema.alterTable("events").dropColumn("text").execute();
  }
}
