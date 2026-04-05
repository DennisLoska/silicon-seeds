import { DB } from "../db/db";
import { truncateJobId } from "./utils";

export const jobList = async (activeJobId?: string, filter?: string) => {
  let jobs = await DB.Jobs.list();

  // Apply filter if specified
  if (filter === "recent") {
    // Sort by created_at descending and take last few
    jobs = jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  } else if (filter === "completed") {
    // Filter for completed jobs based on events
    const completedJobIds = new Set<string>();
    for (const job of jobs) {
      const events = await DB.Events.findByJobId(job.id);
      const hasCompleteEvent = events.some(e => e.status === "complete");
      if (hasCompleteEvent) completedJobIds.add(job.id);
    }
    jobs = jobs.filter(j => completedJobIds.has(j.id));
  } else if (filter === "pending") {
    // Filter for pending jobs (no complete events)
    const pendingJobIds = new Set<string>();
    for (const job of jobs) {
      const events = await DB.Events.findByJobId(job.id);
      const hasCompleteEvent = events.some(e => e.status === "complete");
      if (!hasCompleteEvent) pendingJobIds.add(job.id);
    }
    jobs = jobs.filter(j => pendingJobIds.has(j.id));
  }

  // Pre-fetch all job events for status badges
  const jobStatusMap = new Map<string, { isCompleted: boolean }>();
  for (const job of jobs) {
    const events = await DB.Events.findByJobId(job.id);
    jobStatusMap.set(job.id, {
      isCompleted: events.some(e => e.status === "complete")
    });
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
      <ul className="list rounded-sm w-full lg:w-2/3 flex-start">
          <li className="list-row px-4 py-2 text-sm text-base-content/50">No jobs yet</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter dropdown - wrapped for hx-target inheritance */}
      <div class="flex gap-2">
        <button
          class="btn btn-primary btn-md flex justify-end"
          hx-post="/api/jobs/images"
          hx-trigger="click"
        >
          New Job
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <details class="dropdown">
          <summary class="btn btn-md">Filter</summary>
          <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1.5">
            <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=all" hx-target="#job-content-container" hx-swap="innerHTML">All</a></li>
            <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=recent" hx-target="#job-content-container" hx-swap="innerHTML">Recent</a></li>
            <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=pending" hx-target="#job-content-container" hx-swap="innerHTML">Pending</a></li>
            <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=completed" hx-target="#job-content-container" hx-swap="innerHTML">Completed</a></li>
          </ul>
        </details>
      </div>
      
      <ul className="list rounded-sm max-w-md lg:max-w-lg gap-2">
        {jobs.map((job) => {
          const date = new Date(job.created_at).toLocaleString();
          const isActive = activeJobId === job.id;
          const statusInfo = jobStatusMap.get(job.id);
          const isCompleted = statusInfo?.isCompleted ?? false;
          
          return (
            <li
              key={job.id}
              className={`list-row p-0 flex items-center justify-between rounded-sm shadow-sm hover:shadow-md transition-all ${isActive ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
            >
              <div
                className="flex items-center gap-2 cursor-pointer flex-grow-1 w-full h-full px-4 py-3"
                hx-get={`/api/fragment/${job.id}`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`?job_id=${job.id}&tab=status`}
              >
                <span className={`badge ${isCompleted ? "badge-success" : "badge-warning"}`}>
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </span>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm lg:hidden" style={{ maxWidth: '8ch', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncateJobId(job.id)}</span>
                  <span className="font-bold text-sm hidden lg:inline">{job.id}</span>
                  <span className="text-xs opacity-60">{date}</span>
                </div>
              </div>
              <button
                class="btn btn-ghost btn-sm mr-4"
                hx-delete={`/api/jobs/${job.id}`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                title="Delete job"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};