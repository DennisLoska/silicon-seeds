import { Job } from "../events/events";

export const jobList = (jobs: Job[]) => (
  <div>
    {jobs.length === 0 ? (
      <p class="text-base-content/70">No jobs yet</p>
    ) : (
      jobs.map((job) => {
        const date = new Date(job.created_at).toLocaleString();
        return (
          <a
            key={job.id}
            href="#"
            class="block card bg-base-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            hx-get={`/api/jobs/detail?job_id=${job.id}`}
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            hx-push-url="true"
          >
            <div class="card-body p-3">
              <div class="text-sm font-bold">{job.id}</div>
              <div class="text-xs text-base-content/70">{date}</div>
            </div>
          </a>
        );
      })
    )}
  </div>
);
