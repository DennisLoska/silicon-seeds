import { Kysely, sql } from "kysely";
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("jobs").addColumn("loras", "text").execute();
}
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("jobs").dropColumn("loras").execute();
}
