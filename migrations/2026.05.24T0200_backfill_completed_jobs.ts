import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db
    .updateTable("jobs")
    .set({ status: "complete" })
    .where("status", "=", "active")
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("events")
          .select("events.id")
          .whereRef("events.job_id", "=", "jobs.id"),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("events as non_complete_events")
            .select("non_complete_events.id")
            .whereRef("non_complete_events.job_id", "=", "jobs.id")
            .where("non_complete_events.status", "!=", "complete"),
        ),
      ),
    )
    .execute();
}

export async function down(_db: Kysely<any>): Promise<void> {
  // No-op: this is a data backfill migration.
}
