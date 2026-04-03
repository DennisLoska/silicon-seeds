import { DB } from "../db/db";

export const jobList = async (activeJobId?: string) => {
  const jobs = await DB.Jobs.list();

  return (
    <ul class="menu menu-md w-full p-0">
      {jobs.length === 0 ? (
        <li class="px-4 py-2 text-sm text-base-content/50">No jobs yet</li>
      ) : (
        jobs.map((job) => {
          const date = new Date(job.created_at).toLocaleString();
          const isActive = activeJobId === job.id;
          return (
            <li key={job.id}>
              <a
                class={`flex flex-col items-start py-3 px-4 hover:bg-base-300 transition-colors ${isActive ? "active bg-primary text-primary-content" : ""}`}
                hx-get={`/fragment/${job.id}`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`?job_id=${job.id}&tab=status`}
              >
                <span class="font-bold text-sm truncate" title={job.id}>{job.id.slice(0, 8)}</span>
                <span class="text-[10px] opacity-60">{date}</span>
              </a>
            </li>
          );
        })
      )}
    </ul>
  );
};
