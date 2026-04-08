import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const columnExists = jobsTable?.columns.some((c) => c.name === "resolution");

  if (!columnExists) {
    await db.schema
      .alterTable("jobs")
      .addColumn("resolution", "text")
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const columnExists = jobsTable?.columns.some((c) => c.name === "resolution");

  if (columnExists) {
    await db.schema.alterTable("jobs").dropColumn("resolution").execute();
  }
}
