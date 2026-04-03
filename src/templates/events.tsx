import { Job } from "../events/events";

export const events = async (job: Job, activeTab?: string) => {
  return (
    <div class="space-y-4">
      <h2 class="text-3xl font-bold mb-4">Events</h2>
      <div class="card bg-base-100 shadow-sm">
        <div
          id="events-container"
          class="card-body"
          hx-get={`/api/events?job_id=${job.id}`}
          hx-trigger="load"
        >
          {/* Skeleton loading state */}
          <div class="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical">
            <div class="timeline-middle">
              <span class="loading loading-spinner"></span>
            </div>
            <hr />
            <div class="timeline-start timeline-box">
              <div class="skeleton h-4 w-32 mb-1"></div>
              <div class="skeleton h-16 w-full"></div>
            </div>
            <hr />
          </div>
        </div>
      </div>
    </div>
  );
};
