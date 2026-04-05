import { DB } from "../db/db";

export const jobList = async (activeJobId?: string) => {
  const jobs = await DB.Jobs.list();

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold mb-4">Jobs</h2>
      <ul className="list rounded-sm">
          <li className="list-row px-4 py-2 text-sm text-base-content/50">No jobs yet</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold mb-4">Jobs</h2>
      <ul className="list rounded-sm">
        {jobs.map((job) => {
          const date = new Date(job.created_at).toLocaleString();
          const isActive = activeJobId === job.id;
          return (
            <li key={job.id}>
              <a
                className={`list-row flex flex-col items-start py-2 px-3 rounded-sm hover:bg-base-300 hover:rounded-sm transition-colors ${isActive ? "bg-primary text-primary-content" : ""}`}
                hx-get={`/api/fragment/${job.id}`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`?job_id=${job.id}&tab=status`}
              >
                <span className="font-bold text-xs">{job.id}</span>
                <span className="text-[9px] opacity-60">{date}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};