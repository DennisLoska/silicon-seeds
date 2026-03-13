import assert from "node:assert";
import { Event, JobBaseEvent, JobEvent } from "../events/events";
import { Metadata } from "../meta/meta";
import { QueueManager } from "../queue/queue-manager";

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
      // TODO replace with db call
      const e = QueueManager.findEventById(event.id);
      assert(e, "Associated event not found!");

      if (!jobs[e.jobId].events[e.id]) return;
      jobs[e.jobId].meta[e.id] = event.data;
    });
  }

  export async function create_job() {
    const id = Metadata.randomId();
    // Let me know!
    const job: Job = get_a_new_job(id);

    // TODO Save to actual database
    // - jobs, events
    jobs[id] = job;

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

    // TODO Save to actual database
  }

  export function schedule_task(event: Partial<JobEvent>) {
    const task = create_task(event);
    update_schedule(task);
    event.type && Event.emit(event.type, task);
  }

  // TypeScript sucks
  function create_task(event: Partial<JobEvent>): JobEvent {
    const { jobId, id, mode, type, prompt } = event;
    assert(jobId && type, "Must provide task type to define a task!");
    assert(mode, "Must provide 'mode' to define a  task!");

    const base: JobBaseEvent = {
      id: id ?? Bun.randomUUIDv7(),
      created_at: new Date().toISOString(),
      status: "pending",
      jobId,
      mode,
    };

    switch (event.type) {
      case Event.NewImagePrompt:
        assert(prompt, "Must provide 'prompt' to define an image task!");
        return {
          ...base,
          type: Event.NewImagePrompt,
          prompt,
        };

      case Event.NewVideoPrompt:
        const { filename } = event;
        assert(prompt, "Must provide 'prompt' to define an video task!");
        assert(filename, "Must provide 'filename' to define a videotask!");

        return {
          ...base,
          type: Event.NewVideoPrompt,
          prompt,
          filename,
        };

      case Event.NewTransitionPrompt:
        const { startImg, endImg } = event;
        assert(
          prompt,
          "Must provide 'prompt' to define a video transition task!",
        );
        assert(
          startImg,
          `Must provide '${startImg}' to define a transition task!`,
        );
        assert(endImg, `Must provide '${endImg}' to define a transition task!`);

        return {
          ...base,
          type: Event.NewTransitionPrompt,
          prompt,
          startImg,
          endImg,
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

  function get_a_new_job(id: string): Job {
    return {
      id,
      created_at: new Date().toISOString(),
      events: {},
      meta: {},
    };
  }
}
