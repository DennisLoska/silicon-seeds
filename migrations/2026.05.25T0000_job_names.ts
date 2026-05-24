import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("name")) {
    await db.schema
      .alterTable("jobs")
      .addColumn("name", "text", (col) =>
        col.notNull().defaultTo("Velvet Ember Bloom"),
      )
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("name")) {
    await db.schema.alterTable("jobs").dropColumn("name").execute();
  }
}
