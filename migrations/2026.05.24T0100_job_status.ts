import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (!existingColumns.includes("status")) {
    await db.schema
      .alterTable("jobs")
      .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
      .execute();
  }

  await db
    .updateTable("jobs")
    .set({ status: "failed" })
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("events")
          .select("events.id")
          .whereRef("events.job_id", "=", "jobs.id")
          .where((innerEb) =>
            innerEb.or([
              innerEb("events.status", "=", "pending"),
              innerEb("events.status", "=", "running"),
            ]),
          ),
      ),
    )
    .execute();

  await db
    .updateTable("events")
    .set({
      status: "failed",
      claimed_at: null,
      error: "job failed during queue migration",
    })
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("jobs")
          .select("jobs.id")
          .whereRef("jobs.id", "=", "events.job_id")
          .where("jobs.status", "=", "failed"),
      ),
    )
    .where((eb) =>
      eb.or([
        eb("status", "=", "pending"),
        eb("status", "=", "running"),
      ]),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  const tables = await db.introspection.getTables();
  const jobsTable = tables.find((t) => t.name === "jobs");
  const existingColumns = jobsTable?.columns.map((c) => c.name) ?? [];

  if (existingColumns.includes("status")) {
    await db.schema.alterTable("jobs").dropColumn("status").execute();
  }
}
