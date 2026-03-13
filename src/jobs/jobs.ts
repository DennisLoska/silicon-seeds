import assert from "node:assert";
import { Event, JobBaseEvent, JobEvent } from "../events/events";
import { Metadata } from "../meta/meta";

type Job = {
  id: string;
  created_at: string;
  events: Record<string, JobEvent>;
  schedule: JobEvent[];
  scheduledImages: number;
  completedImages: number;
  scheduledClips: number;
  completedClips: number;
  scheduledTransitions: number;
  completedTransitions: number;
};

export namespace JobOrchestrator {
  export const jobs: Record<string, Job> = {};

  export async function create_job() {
    const id = Metadata.randomId();
    // Let me know!
    const job: Job = get_a_new_job(id);

    // TODO Save to actual database
    // - jobs, events
    jobs[id] = job;

    return job;
  }

  export function update_job(event: JobEvent) {
    const { jobId, id } = event;
    jobs[jobId].events[id] = event;

    if (event.status !== "complete") return;

    if (event.type === Event.NewImagePrompt) {
      jobs[jobId].completedImages++;
    } else if (event.type === Event.NewVideoPrompt) {
      jobs[jobId].completedClips++;
    } else if (event.type === Event.NewTransitionPrompt) {
      jobs[jobId].completedTransitions++;
    }

    // TODO Save to actual database
  }

  export function define_schedule(
    id: string,
    schedules: { images?: number; transitions?: number; clips?: number },
  ) {
    const { clips, images, transitions } = schedules;

    jobs[id].scheduledClips = clips ?? 0;
    jobs[id].scheduledTransitions = transitions ?? 0;
    jobs[id].scheduledImages = images ?? 0;
  }

  export function schedule_task(event: Partial<JobEvent>) {
    event.type && Event.emit(event.type, create_task(event));
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
      schedule: [],
      scheduledImages: 0,
      completedImages: 0,
      scheduledClips: 0,
      completedClips: 0,
      scheduledTransitions: 0,
      completedTransitions: 0,
    };
  }
}
