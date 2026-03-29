import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { Generated } from "kysely";

export interface DbSchema {
  jobs: {
    id: Generated<string>;
    created_at: Generated<string>;
  };
  events: {
    id: Generated<string>;
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
    created_at: Generated<string>;
  };
  meta: {
    id: Generated<string>;
    event_id: string;
    filename: string;
    subfolder: string;
    type: string;
  };
}

export namespace DB {
  export const db = new Kysely<DbSchema>({
    dialect: new BunSqliteDialect({
      database: new Database("silicon-seeds.sqlite"),
    }),
  });

  export namespace Jobs {
    export async function create_job() {
      return await db
        .insertInto("jobs")
        .defaultValues()
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  export namespace Meta {
    export async function insert_meta(payload: Omit<DbSchema["meta"], "id">) {
      return await db
        .insertInto("meta")
        .orFail()
        .values({
          ...payload,
        })
        .execute();
    }
  }
}
