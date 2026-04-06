import { Job } from "../events/events";

export const Events = async (job: Job) => (
  <div className="space-y-4">
    <h2 className="text-3xl font-bold mb-4">Events</h2>
    <div
      id="events-container"
      className="card-body"
      hx-get={`/jobs/events?job_id=${job.id}`}
      hx-trigger="load"
    >
      <span className="skeleton skeleton-text">Melting some GPUs...</span>
    </div>
  </div>
);
