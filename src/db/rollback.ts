import { DB } from "./db";
import { migrator } from "./migrate";

const { error, results } = await migrator.migrateDown();

if (error) {
  console.error("Rollback failed:", error);
  process.exit(1);
}

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`✓ Migration "${it.migrationName}" rolled back`);
  }
});

await DB.db.destroy();
