import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { Generated } from "kysely";
import { Metadata } from "../meta/meta";
import { Event, JobEvent, JobMode, JobStatus } from "../events/events";
import { Lora } from "../styles/presets";
import { Utils } from "../utils/utils";

export interface DbSchema {
  jobs: {
    id: string;
    created_at: Generated<string> | string;
    fps: number;
    clip_duration: number;
    transition_duration: number;
    resolution: string;
    image_model: string;
    video_model: string;
    style_preset: string;
  };
  events: {
    id: string;
    created_at: Generated<string> | string;
    job_id: string;
    mode: JobMode;
    status: JobStatus;
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
    type: "input" | "output" | "temp";
  };
}

export type JobsSchema = Omit<DbSchema["jobs"], "created_at"> & {
  created_at: string;
};
export type EventsSchema = DbSchema["events"];
export type MetaSchema = DbSchema["meta"];

export type CreateJob = Omit<DbSchema["jobs"], "id" | "created_at">;

export namespace DB {
  export const db = new Kysely<DbSchema>({
    dialect: new BunSqliteDialect({
      database: new Database("silicon-seeds.sqlite"),
    }),
  });

  export namespace Jobs {
    export async function create_job(payload: CreateJob) {
      return await db
        .insertInto("jobs")
        .values({
          id: Metadata.randomId(),
          ...payload,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    export async function list() {
      return await DB.db
        .selectFrom("jobs")
        .selectAll()
        .orderBy("created_at", "desc")
        .execute();
    }

    export async function findById(id: string): Promise<JobsSchema> {
      return await DB.db
        .selectFrom("jobs")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();
    }

    export async function deleteById(id: string) {
      // First delete all related events to avoid orphaned records
      await db.deleteFrom("events").where("job_id", "=", id).execute();

      // Then delete the job
      await db.deleteFrom("jobs").where("id", "=", id).execute();
    }
  }

  export namespace Events {
    function eventToRow(event: JobEvent) {
      const base = {
        id: event.id,
        job_id: event.jobId,
        mode: event.mode,
        status: event.status,
        type: event.type,
        prompt: event.prompt,
      };

      switch (event.type) {
        case Event.NewTextPrompt:
          return {
            ...base,
            text: event.text,
          };

        case Event.NewImagePrompt:
          return {
            ...base,
            filename: null,
            lora: event.lora,
            start_img: null,
            end_img: null,
            duration: null,
            index: event.index,
          };

        case Event.NewVideoPrompt:
          return {
            ...base,
            filename: event.filename,
            start_img: null,
            end_img: null,
            duration: null,
            index: event.index,
          };

        case Event.NewTransitionPrompt:
          return {
            ...base,
            filename: null,
            start_img: event.startImg,
            end_img: event.endImg,
            duration: null,
            index: event.index,
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

    function rowToEvent(
      row: Omit<DbSchema["events"], "created_at"> & { created_at: string },
    ): JobEvent {
      const base = {
        id: row.id,
        jobId: row.job_id,
        mode: row.mode,
        status: row.status,
        type: row.type,
        created_at: row.created_at,
        prompt: row.prompt,
      };

      switch (row.type) {
        case Event.NewImagePrompt:
          Utils.assert(row.prompt, "'prompt' is not null");
          return {
            ...base,
            lora: row.lora ?? undefined,
            index: row.index ?? undefined,
            type: Event.NewImagePrompt,
            prompt: row.prompt,
          };
        case Event.NewVideoPrompt:
          Utils.assert(row.prompt, "'prompt' is not null");
          return {
            ...base,
            filename: row.filename!,
            index: row.index ?? undefined,
            type: Event.NewVideoPrompt,
            prompt: row.prompt,
          };
        case Event.NewTransitionPrompt:
          Utils.assert(row.prompt, "'prompt' is not null");
          return {
            ...base,
            startImg: row.start_img!,
            endImg: row.end_img!,
            index: row.index ?? undefined,
            type: Event.NewTransitionPrompt,
            prompt: row.prompt,
          };
        case Event.NewAudioPrompt:
          return {
            ...base,
            duration: row.duration ?? undefined,
            type: Event.NewAudioPrompt,
            prompt: row.prompt,
          };
        default:
          throw new Error(`Unknown event type`);
      }
    }

    export async function create(payload: JobEvent) {
      const res = await db
        .insertInto("events")
        .values(eventToRow(payload))
        .returningAll()
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function findById(id: string) {
      const res = await db
        .selectFrom("events")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function updateStatus(id: string, status: JobStatus) {
      const res = await db
        .updateTable("events")
        .set("status", status)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function findByJobId(jobId: string) {
      const res = await db
        .selectFrom("events")
        .selectAll()
        .where("job_id", "=", jobId)
        .orderBy("created_at", "asc")
        .execute();

      return res.map(rowToEvent);
    }
  }

  export namespace Meta {
    export async function create(payload: Omit<MetaSchema, "id">) {
      return await db
        .insertInto("meta")
        .orFail()
        .values({
          id: Metadata.randomId(),
          ...payload,
        })
        .execute();
    }

    export async function findByEventId(eventId: string) {
      const res = await db
        .selectFrom("meta")
        .selectAll()
        .where("event_id", "=", eventId)
        .executeTakeFirstOrThrow();

      return res;
    }
  }

  export namespace Gallery {
    type ListItemResult = {
      meta_id: string;
      event_id: string;
      filename: string;
      subfolder: string;
      type: "input" | "output" | "temp";
      event_created_at: string;
      job_id: string;
    };

    type ListItemsOptions = {
      cursor?: string; // meta.id (UUID7) for pagination
      type?: "image" | "video";
      limit?: number;
    };

    function getMediaTypeFromExtension(
      filename: string,
    ): "image" | "video" | null {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (!ext) return null;

      const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
      const videoExts = ["mp4", "mov", "avi", "mkv", "webm"];

      if (imageExts.includes(ext)) return "image";
      if (videoExts.includes(ext)) return "video";
      return null;
    }

    export async function listItems(options: ListItemsOptions = {}) {
      const { cursor, type, limit = 20 } = options;

      let query = DB.db
        .selectFrom("meta")
        .innerJoin("events", "events.id", "meta.event_id")
        .innerJoin("jobs", "jobs.id", "events.job_id")
        .select([
          "meta.id as meta_id",
          "meta.event_id",
          "meta.filename",
          "meta.subfolder",
          "meta.type as meta_type",
          "events.created_at as event_created_at",
          "events.status as event_status",
          "events.id as event_id",
          "jobs.id as job_id",
        ])
        .where("meta.type", "=", "output");

      if (cursor) {
        // UUID7 is sortable - just use < for pagination
        query = query.where("meta.id", "<", cursor);
      }

      if (type) {
        const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
        const videoExts = ["mp4", "mov", "avi", "mkv", "webm"];

        const extList = type === "image" ? imageExts : videoExts;
        query = query.where((eb) =>
          eb.or(extList.map((ext) => eb("meta.filename", "like", `%.${ext}`))),
        );
      }

      const results = await query
        .orderBy("meta.id", "desc") // UUID7 is sortable chronologically!
        .limit(limit)
        .execute();

      return results.map((row) => {
        const mediaType = getMediaTypeFromExtension(row.filename);
        return {
          meta_id: row.meta_id,
          event_id: row.event_id,
          filename: row.filename,
          subfolder: row.subfolder,
          type: row.meta_type,
          created_at: row.event_created_at,
          job_id: row.job_id,
          mediaType: mediaType,
        } as ListItemResult & {
          mediaType: "image" | "video" | null;
          created_at: string;
        };
      });
    }
  }
}
