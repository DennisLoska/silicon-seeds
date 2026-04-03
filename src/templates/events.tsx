import { Job } from "../events/events";

export const events = async (job: Job, activeTab?: string) => {
  return (
    <div class="space-y-4">
      <h2 class="text-3xl font-bold mb-4">Events</h2>
      <div
        id="events-container"
        class="card-body"
        hx-get={`/api/events?job_id=${job.id}`}
        hx-trigger="load"
      >
        {/* Skeleton loading state */}
        <span className="skeleton skeleton-text">Melting some GPUs...</span>
      </div>
    </div>
  );
};
