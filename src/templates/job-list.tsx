import { DB } from "../db/db";

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
        <h2 className="text-3xl font-bold mb-4">Jobs</h2>
      <ul className="list rounded-sm w-full lg:w-2/3 flex-start">
          <li className="list-row px-4 py-2 text-sm text-base-content/50">No jobs yet</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-bold mb-4">Jobs</h2>
      
      {/* Filter dropdown */}
      <details class="dropdown">
        <summary class="btn btn-md">Filter</summary>
        <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1.5">
          <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=all" hx-target="#job-content-container" hx-swap="innerHTML">All</a></li>
          <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=recent" hx-target="#job-content-container" hx-swap="innerHTML">Recent</a></li>
          <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=pending" hx-target="#job-content-container" hx-swap="innerHTML">Pending</a></li>
          <li><a hx-get="/api/jobs/list-view?page=jobs&current_id=&filter=completed" hx-target="#job-content-container" hx-swap="innerHTML">Completed</a></li>
        </ul>
      </details>
      
      <ul className="list rounded-sm max-w-md lg:max-w-lg">
        {jobs.map((job) => {
          const date = new Date(job.created_at).toLocaleString();
          const isActive = activeJobId === job.id;
          const statusInfo = jobStatusMap.get(job.id);
          const isCompleted = statusInfo?.isCompleted ?? false;
          
          return (
            <li key={job.id}>
              <a
                className={`list-row flex items-center justify-between py-3 px-4 rounded-sm shadow-sm hover:shadow-md transition-all cursor-pointer ${isActive ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
                hx-get={`/api/fragment/${job.id}`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`?job_id=${job.id}&tab=status`}
              >
                <div className="flex flex-col items-start">
                  <span className="font-bold text-sm">{job.id}</span>
                  <span className="text-xs opacity-60">{date}</span>
                </div>
                <span className={`badge ${isCompleted ? "badge-success" : "badge-warning"}`}>
                  {isCompleted ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};