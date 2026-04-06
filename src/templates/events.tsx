import { Job } from "../events/events";

export const events = async (job: Job, activeTab?: string) => {
  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold mb-4">Events</h2>
      <div
        id="events-container"
        className="card-body"
        hx-get={`/api/events?job_id=${job.id}`}
        hx-trigger="load"
      >
        {/* Skeleton loading state */}
        <span className="skeleton skeleton-text">Melting some GPUs...</span>
      </div>
      {/* Fallback when no events */}
      <div id="events-container" className="hidden">
        <p>Events will appear here once the job runs</p>
      </div>
    </div>
  );
};
