import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { Generated } from "kysely";
import { Metadata } from "../meta/meta";
import { Event, JobEvent, JobMode } from "../events/events";
import { Lora } from "../styles/presets";

export interface DbSchema {
  jobs: {
    id: string;
    created_at: Generated<string>;
  };
  events: {
    id: string;
    created_at: Generated<string>;
    job_id: string;
    mode: JobMode;
    status: string;
    type: Event;
    prompt: string | null;
    filename: string | null;
    start_img: string | null;
    end_img: string | null;
    duration: number | null;
    lora: Lora | null;
    index: number | null;
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
    function eventToRow(event: JobEvent) {
      const base = {
        id: Metadata.randomId(),
        job_id: event.jobId,
        mode: event.mode,
        status: event.status,
        type: event.type,
        prompt: event.prompt ?? null,
        lora: "lora" in event ? event.lora : null,
        index: "index" in event ? event.index : null,
      };

      switch (event.type) {
        case Event.NewImagePrompt:
          return {
            ...base,
            filename: null,
            start_img: null,
            end_img: null,
            duration: null,
          };

        case Event.NewVideoPrompt:
          return {
            ...base,
            filename: event.filename,
            start_img: null,
            end_img: null,
            duration: null,
          };

        case Event.NewTransitionPrompt:
          return {
            ...base,
            filename: null,
            start_img: event.startImg,
            end_img: event.endImg,
            duration: null,
          };

        case Event.NewAudioPrompt:
          return {
            ...base,
            filename: null,
            start_img: null,
            end_img: null,
            duration: event.duration ?? null,
          };
      }
    }

    export async function create_event(payload: JobEvent) {
      return await db
        .insertInto("events")
        .values(eventToRow(payload))
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
