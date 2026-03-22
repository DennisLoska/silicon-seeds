import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";

export interface DbSchema {
  jobs: {
    id: string;
    created_at: Date;
  };
  events: {
    id: string;
    job_id: string;
    type: string;
    mode: string;
    status: string;
    prompt: string | null;
    filename: string | null;
    start_img: string | null;
    end_img: string | null;
    duration: number | null;
    lora: string | null;
    index: number | null;
    meta_data: string | null;
    created_at: Date;
  };
  meta: {
    id: string;
    event_id: string;
    filename: string;
    subfolder: string;
    type: string;
  };
}

export namespace DB {
  export const client = new Kysely<DbSchema>({
    dialect: new BunSqliteDialect({
      database: new Database("silicon-seeds.sqlite"),
    }),
  });
}
