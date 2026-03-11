import { JobEvent, JobEvents } from "../events/events";
import { Metadata } from "../meta/meta";

type Job = {
  id: string;
  created_at: string;
  events: JobEvents;
};

export namespace JobOrchestrator {
  export async function create_job() {
    const id = Metadata.randomId();
    const job: Job = {
      id,
      created_at: new Date().toISOString(),
      events: [],
    };

    // TODO Save to actual database

    return job;
  }

  export function update_job(event: JobEvent) {
    const { jobId } = event;
    // TODO Save to actual database
  }
}
