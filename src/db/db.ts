import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { Generated } from "kysely";
import { Metadata } from "../meta/meta";
import {
  Event,
  JobEvent,
  JobLifecycleStatus,
  JobMode,
  JobStatus,
} from "../events/events";
import { Lora } from "../styles/presets";
import { Utils } from "../utils/utils";

export interface DbSchema {
  jobs: {
    id: string;
    created_at: Generated<string> | string;
    status: JobLifecycleStatus;
    fps?: number;
    clip_duration?: number;
    transition_duration?: number;
    resolution?: string;
    image_model?: string;
    video_model?: string;
    style_preset?: string;
  };
  events: {
    id: string;
    created_at: Generated<string> | string;
    job_id: string;
    mode: JobMode;
    status: JobStatus;
    priority: number;
    type: Event;
    text: string | null;
    prompt: string | null;
    filename: string | null;
    start_img: string | null;
    end_img: string | null;
    duration: number | null;
    lora: Lora | null;
    index: number | null;
    claimed_at: string | null;
    attempt_count: number;
    error: string | null;
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

export type CreateJob = Omit<DbSchema["jobs"], "id" | "created_at" | "status">;

export namespace DB {
  export const db = new Kysely<DbSchema>({
    dialect: new BunSqliteDialect({
      database: new Database("silicon-seeds.sqlite"),
    }),
  });

  export namespace Jobs {
    export type CancelJobResult = {
      job: JobsSchema;
      runningPromptId: string | null;
      pendingPromptIds: string[];
    };

    export async function create_job(payload: CreateJob) {
      return await db
        .insertInto("jobs")
        .values({
          id: Metadata.randomId(),
          status: JobLifecycleStatus.Active,
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

    export async function updateStatus(id: string, status: JobLifecycleStatus) {
      return await db
        .updateTable("jobs")
        .set({ status })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    export async function failJob(id: string) {
      await db.transaction().execute(async (trx) => {
        const updatedJob = await trx
          .updateTable("jobs")
          .set({ status: JobLifecycleStatus.Failed })
          .where("id", "=", id)
          .where("status", "=", JobLifecycleStatus.Active)
          .returning("id")
          .executeTakeFirst();

        if (!updatedJob) {
          return;
        }

        await trx
          .updateTable("events")
          .set({
            status: JobStatus.Failed,
            claimed_at: null,
            error: "job failed",
          })
          .where("job_id", "=", id)
          .where((eb) =>
            eb.or([
              eb("status", "=", JobStatus.Pending),
              eb("status", "=", JobStatus.Running),
            ]),
          )
          .execute();
      });
    }

    export async function cancelJob(id: string): Promise<CancelJobResult> {
      return await db.transaction().execute(async (trx) => {
        const job = await trx
          .selectFrom("jobs")
          .selectAll()
          .where("id", "=", id)
          .executeTakeFirstOrThrow();

        const events = await trx
          .selectFrom("events")
          .select(["id", "status"])
          .where("job_id", "=", id)
          .execute();

        const runningPromptId =
          events.find((event) => event.status === JobStatus.Running)?.id ?? null;
        const pendingPromptIds = events
          .filter((event) => event.status === JobStatus.Pending)
          .map((event) => event.id);

        if (job.status === JobLifecycleStatus.Active) {
          await trx
            .updateTable("jobs")
            .set({ status: JobLifecycleStatus.Cancelled })
            .where("id", "=", id)
            .execute();

          await trx
            .updateTable("events")
            .set({
              status: JobStatus.Failed,
              claimed_at: null,
              error: "job cancelled by user",
            })
            .where("job_id", "=", id)
            .where((eb) =>
              eb.or([
                eb("status", "=", JobStatus.Pending),
                eb("status", "=", JobStatus.Running),
              ]),
            )
            .execute();
        }

        return {
          job,
          runningPromptId,
          pendingPromptIds,
        };
      });
    }

    export async function failBrokenJobs() {
      const brokenJobs = await db
        .selectFrom("jobs")
        .innerJoin("events", "events.job_id", "jobs.id")
        .select("jobs.id")
        .distinct()
        .where("jobs.status", "=", JobLifecycleStatus.Active)
        .where((eb) =>
          eb.or([
            eb("events.status", "=", JobStatus.Pending),
            eb("events.status", "=", JobStatus.Running),
          ]),
        )
        .execute();

      for (const job of brokenJobs) {
        await failJob(job.id);
      }
    }

    export async function completeJob(id: string) {
      return await updateStatus(id, JobLifecycleStatus.Complete);
    }

    export async function finalizeCompletedJobs() {
      const jobsToComplete = await db
        .selectFrom("jobs")
        .innerJoin("events", "events.job_id", "jobs.id")
        .select("jobs.id")
        .distinct()
        .where("jobs.status", "=", JobLifecycleStatus.Active)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("events as blocking_events")
                .select("blocking_events.id")
                .whereRef("blocking_events.job_id", "=", "jobs.id")
                .where((innerEb) =>
                  innerEb.or([
                    innerEb("blocking_events.status", "=", JobStatus.Pending),
                    innerEb("blocking_events.status", "=", JobStatus.Running),
                  ]),
                ),
            ),
          ),
        )
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("events as non_complete_events")
                .select("non_complete_events.id")
                .whereRef("non_complete_events.job_id", "=", "jobs.id")
                .where("non_complete_events.status", "!=", JobStatus.Complete),
            ),
          ),
        )
        .execute();

      for (const job of jobsToComplete) {
        await completeJob(job.id);
      }
    }
  }

  export namespace Events {
    function eventToRow(event: JobEvent) {
      const base = {
        id: event.id,
        job_id: event.jobId,
        mode: event.mode,
        status: event.status,
        priority: event.priority ?? 0,
        type: event.type,
        prompt: event.prompt,
        claimed_at: event.claimed_at ?? null,
        attempt_count: event.attempt_count ?? 0,
        error: event.error ?? null,
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
        case Event.NewVideoComposition:
          return {
            ...base,
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
        priority: row.priority,
        type: row.type,
        created_at: row.created_at,
        prompt: row.prompt,
        claimed_at: row.claimed_at ?? undefined,
        attempt_count: row.attempt_count,
        error: row.error,
      };

      switch (row.type) {
        case Event.NewTextPrompt:
          Utils.assert(row.prompt, "'prompt' is null");
          return {
            ...base,
            text: row.text!,
            type: Event.NewTextPrompt,
            prompt: row.prompt,
          };
        case Event.NewImagePrompt:
          Utils.assert(row.prompt, "'prompt' is null");
          return {
            ...base,
            lora: row.lora ?? undefined,
            index: row.index ?? undefined,
            type: Event.NewImagePrompt,
            prompt: row.prompt,
          };
        case Event.NewVideoPrompt:
          Utils.assert(row.prompt, "'prompt' is null");
          return {
            ...base,
            filename: row.filename!,
            index: row.index ?? undefined,
            type: Event.NewVideoPrompt,
            prompt: row.prompt,
          };
        case Event.NewVideoComposition:
          Utils.assert(row.prompt, "'prompt' is null");
          return {
            ...base,
            type: Event.NewVideoComposition,
            prompt: row.prompt,
          };
        case Event.NewTransitionPrompt:
          Utils.assert(row.prompt, "'prompt' is null");
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
            prompt: row.prompt ?? "n/a",
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
        .set({
          status,
          claimed_at: status === JobStatus.Running ? new Date().toISOString() : null,
          error: status === JobStatus.Failed ? "unknown" : null,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function markComplete(id: string) {
      const res = await db
        .updateTable("events")
        .set({
          status: JobStatus.Complete,
          claimed_at: null,
          error: null,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function markFailed(id: string, error: string) {
      const res = await db
        .updateTable("events")
        .set({
          status: JobStatus.Failed,
          claimed_at: null,
          error,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return rowToEvent(res);
    }

    export async function requeueRunning() {
      await db
        .updateTable("events")
        .set({
          status: JobStatus.Pending,
          claimed_at: null,
        })
        .where("status", "=", JobStatus.Running)
        .execute();
    }

    export async function hasRunning() {
      const res = await db
        .selectFrom("events")
        .select("id")
        .where("status", "=", JobStatus.Running)
        .executeTakeFirst();

      return Boolean(res);
    }

    export async function claimNextRunnable() {
      const candidate = await db
        .selectFrom("events")
        .innerJoin("jobs", "jobs.id", "events.job_id")
        .select("events.id")
        .where("events.status", "=", JobStatus.Pending)
        .where("jobs.status", "=", JobLifecycleStatus.Active)
        .orderBy("events.priority", "desc")
        .orderBy("events.index", "asc")
        .orderBy("events.created_at", "asc")
        .executeTakeFirst();

      if (!candidate) return null;

      const res = await db
        .updateTable("events")
        .set({
          status: JobStatus.Running,
          claimed_at: new Date().toISOString(),
          attempt_count: (eb) => eb("attempt_count", "+", 1),
          error: null,
        })
        .where("id", "=", candidate.id)
        .where("status", "=", JobStatus.Pending)
        .returningAll()
        .executeTakeFirst();

      return res ? rowToEvent(res) : null;
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
