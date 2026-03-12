import { Event, JobEvent } from "../events/events";
import { Metadata } from "../meta/meta";

type Job = {
  id: string;
  created_at: string;
  events: Record<string, JobEvent>;
  scheduledImages: number;
  completedImages: number;
  scheduledClips: number;
  completedClips: number;
  scheduledTransitions: number;
  completedTransitions: number;
};

// TODO could add an init function to subscribe to changes to the above fields
// when the completed clips count matches the scheduled clips count this means
// that work on all the transitions can be started and derived from the respective
// first and last frame from the start + end image of each tuple which can be
// accessed by filtering for the new_video_prompt event.type through the list of
// all the associated events with this particular job
// Or this check is being done in the VideoGenerator subscriber because that one is
// actually responsible for scheduling transitions and not the JobOrchestrator as the
// JobOrchestrator should just be managing the Job's progress state and not deal with
// the entire pipeline logic.

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
    schedules: { images: number; transitions: number; clips: number },
  ) {
    const { clips, images, transitions } = schedules;

    jobs[id].scheduledClips = clips;
    jobs[id].scheduledTransitions = transitions;
    jobs[id].scheduledImages = images;
  }

  function get_a_new_job(id: string): Job {
    return {
      id,
      created_at: new Date().toISOString(),
      events: {},
      scheduledImages: 0,
      completedImages: 0,
      scheduledClips: 0,
      completedClips: 0,
      scheduledTransitions: 0,
      completedTransitions: 0,
    };
  }
}
