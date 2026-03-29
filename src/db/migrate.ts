import { DB } from "./db";
import { Migrator, FileMigrationProvider } from "kysely";
import * as fs from "fs";
import * as path from "path";

const migrationFolder = path.join(import.meta.dir, "../../migrations");

export const migrator = new Migrator({
  db: DB.db,
  provider: new FileMigrationProvider({
    fs: {
      readdir: async (p) => await fs.promises.readdir(p),
      stat: (p) => fs.promises.stat(p),
      read: async (p) => await fs.promises.readFile(p, "utf-8"),
    },
    path: {
      join: (...paths) => paths.join("/"),
    },
    migrationFolder,
  }),
});

const { error, results } = await migrator.migrateToLatest();

if (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`✓ Migration "${it.migrationName}" executed`);
  }
});

await DB.db.destroy();
