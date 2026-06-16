import { Kysely, sql } from "kysely";
import type { DbSchema } from "../src/db/db";

export async function up(db: Kysely<DbSchema>): Promise<void> {
  await db.schema
    .alterTable("hypercut_suggestions")
    .addColumn("asset_filename", "text")
    .execute();

  await db.schema
    .alterTable("hypercut_suggestions")
    .addColumn("asset_subfolder", "text")
    .execute();

  // Backfill existing suggestions: match asset_id (filename stem) against meta.filename
  // asset_id stores ComfyUI output filename stem e.g. "019e..._00001_"
  // meta.filename stores full filename e.g. "019e..._00001_.png"
  await sql`
    UPDATE hypercut_suggestions
    SET asset_filename = m.filename,
        asset_subfolder = m.subfolder
    FROM meta m
    WHERE hypercut_suggestions.asset_filename IS NULL
      AND hypercut_suggestions.asset_id IS NOT NULL
      AND hypercut_suggestions.source_type != 'autocut_cut'
      AND m.filename LIKE hypercut_suggestions.asset_id || '.%'
  `.execute(db);
}

export async function down(db: Kysely<DbSchema>): Promise<void> {
  await db.schema
    .alterTable("hypercut_suggestions")
    .dropColumn("asset_filename")
    .execute();

  await db.schema
    .alterTable("hypercut_suggestions")
    .dropColumn("asset_subfolder")
    .execute();
}
