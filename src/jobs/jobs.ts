import { DB } from "../db/db";
import { Event, JobBaseEvent, JobEvent } from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { Utils } from "../utils/utils";

type Job = {
  id: string;
  created_at: string;
  events: Record<string, JobEvent>;
  meta: Record<string, unknown>;
};

export namespace JobOrchestrator {
  export const jobs: Record<string, Job> = {};

  export function init() {
    Event.on(Event.ComfyExecuted, (event) => {
      const e = QueueManager.findEventById(event.id);
      Utils.assert(e, "Associated event not found!");

      if (!jobs[e.jobId].events[e.id]) return;
      jobs[e.jobId].meta[e.id] = event.data;

      const data: { filename: string; subfolder: string; type: string }[] =
        event.data.images as any;
      Utils.assert(Array.isArray(data), "Metadata is not an array");
      const [metadata] = data;

      void DB.Meta.insert_meta({
        event_id: event.id,
        filename: metadata.filename,
        subfolder: metadata.subfolder,
        type: metadata.type,
      });
    });
  }

  export async function create_job() {
    // Let me know!
    // const job: Job = get_a_new_job(id);
    const job = await DB.Jobs.create_job();

    // TODO Save to actual database
    // - jobs, events
    jobs[job.id] = {
      ...job,
      events: {},
      meta: {},
    };

    return job;
  }

  export function job_events(id: string) {
    return Object.values(jobs[id].events);
  }

  export function update_schedule(event: JobEvent) {
    const { jobId, id } = event;

    if (!jobs[jobId].events[id]) {
      jobs[jobId].events[id] = event;
    }

    if (event.status !== "complete") return;
    jobs[jobId].events[id].status = event.status;

    void DB.Events.create_event(event);
  }

  export function schedule_task(event: Partial<JobEvent>) {
    const task = create_task(event);
    update_schedule(task);
    event.type && Event.emit(event.type, task);
  }

  // TypeScript sucks
  function create_task(event: Partial<JobEvent>): JobEvent {
    const { jobId, id, mode, type, prompt } = event;
    Utils.assert(jobId && type, "Must provide task type to define a task!");
    Utils.assert(mode, "Must provide 'mode' to define a  task!");

    const base: JobBaseEvent = {
      id: id ?? Bun.randomUUIDv7(),
      created_at: new Date().toISOString(),
      status: "pending",
      jobId,
      mode,
    };

    switch (event.type) {
      case Event.NewImagePrompt:
        Utils.assert(prompt, "Must provide 'prompt' to define an image task!");
        return {
          ...base,
          type: Event.NewImagePrompt,
          prompt,
          lora: event.lora,
          index: event.index,
        };

      case Event.NewVideoPrompt:
        const { filename } = event;
        Utils.assert(prompt, "Must provide 'prompt' to define an video task!");
        Utils.assert(
          filename,
          "Must provide 'filename' to define a videotask!",
        );

        return {
          ...base,
          type: Event.NewVideoPrompt,
          prompt,
          filename,
          index: event.index,
        };

      case Event.NewTransitionPrompt:
        const { startImg, endImg } = event;
        Utils.assert(
          prompt,
          "Must provide 'prompt' to define a video transition task!",
        );
        Utils.assert(
          startImg,
          `Must provide '${startImg}' to define a transition task!`,
        );
        Utils.assert(
          endImg,
          `Must provide '${endImg}' to define a transition task!`,
        );

        return {
          ...base,
          type: Event.NewTransitionPrompt,
          prompt,
          startImg,
          endImg,
          index: event.index,
        };

      case Event.NewAudioPrompt:
        const { duration } = event;

        return {
          ...base,
          type: Event.NewAudioPrompt,
          prompt,
          duration,
        };

      default:
        break;
    }

    throw new Error(`Task of type ${event.type} does not exist.`);
  }
}
