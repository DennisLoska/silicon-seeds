import { Job } from "../events/events";

export const jobList = (jobs: Job[]) => (
  <div>
    {jobs.length === 0 ? (
      <p class="text-base-content/70">No jobs yet</p>
    ) : (
      jobs.map((job) => {
        const date = new Date(job.created_at).toLocaleString();
        return (
          <div key={job.id} class="card bg-base-100 shadow-sm">
            <div class="card-body p-3">
              <div class="text-sm font-bold">{job.id}</div>
              <div class="text-xs text-base-content/70">{date}</div>
            </div>
          </div>
        );
      })
    )}
  </div>
);
