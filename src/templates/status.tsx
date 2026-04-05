import { DB } from "../db/db";
import { Job } from "../events/events";

export const status = async (job: Job) => {
  // Check if job has any complete events
  const events = await DB.Events.findByJobId(job.id);
  const isCompleted = events.some(e => e.status === "complete");
  
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-base-content">
          Status <span className={`badge badge-xl ${isCompleted ? "badge-success" : "badge-warning"}`}>
            {isCompleted ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </span>
        </h2>
        <p className="text-base-content/60 mt-1">
          Detailed overview of job execution and state.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Job ID
            </div>
            <div className="stat-value text-lg truncate px-1">{job.id}</div>
          </div>
        </div>

        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Created At
            </div>
            <div className="stat-value text-lg">
              {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
            Summary
          </h2>
          <p className="text-base-content mt-2 italic opacity-80 text-lg">
            No execution events recorded yet for this job.
          </p>
        </div>
      </div>
    </div>
  );
};