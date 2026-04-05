import { Job } from "../events/events";

export const status = async (job: Job) => {
  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-base-content">
          Job Status
        </h2>
        <p className="text-base-content/60 mt-1">
          Detailed overview of job execution and state.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Status
            </div>
            <div className="flex items-center gap-2">
              <div className="badge badge-success badge-sm">Active</div>
              <span className="text-lg">Running</span>
            </div>
          </div>
        </div>

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

      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="card-body">
          <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
            Summary
          </h3>
          <p className="text-base-content mt-2 italic opacity-80 text-lg">
            No execution events recorded yet for this job.
          </p>
        </div>
      </div>
    </div>
  );
};
