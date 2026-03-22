import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";

export interface DbSchema {
  jobs: {
    id: number;
    name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  };
  events: {
    id: number;
    job_id: number | null;
    type: string;
    data: string;
    created_at: Date;
  };
}

const db = new Kysely<DbSchema>({
  dialect: new SqliteDialect({
    database: async () => new Database("silicon-seeds.sqlite"),
  }),
});

export default db;
