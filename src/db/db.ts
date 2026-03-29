import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { Generated } from "kysely";
import { Metadata } from "../meta/meta";
import { JobEvent } from "../events/events";

export interface DbSchema {
  jobs: {
    id: string;
    created_at: Generated<string>;
  };
  events: Omit<JobEvent, "created_at">;
  meta: {
    id: string;
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
        .values({
          id: Metadata.randomId(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  }

  export namespace Events {
    export async function create_event(
      payload: Omit<DbSchema["events"], "id" | "created_at">,
    ) {
      return await db
        .insertInto("events")
        .values({
          ...payload,
          id: Metadata.randomId(),
        })
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
          id: Metadata.randomId(),
          ...payload,
        })
        .execute();
    }
  }
}
