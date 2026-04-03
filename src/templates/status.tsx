import { Job } from "../events/events";

export const status = async (job: Job) => {
  return (
    <div class="space-y-8">
      <header>
        <h2 class="text-3xl font-extrabold tracking-tight text-base-content">Job Status</h2>
        <p class="text-base-content/60 mt-1">Detailed overview of job execution and state.</p>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="stats shadow bg-base-200">
          <div class="stat">
            <div class="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">Job ID</div>
            <div class="stat-value text-lg truncate px-1">{job.id}</div>
          </div>
        </div>

        <div class="stats shadow bg-base-200">
          <div class="stat">
            <div class="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">Created At</div>
            <div class="stat-value text-lg">{new Date(job.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div class="stats shadow bg-base-200">
          <div class="stat">
            <div class="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">Status</div>
            <div class="flex items-center gap-2">
               <div class="badge badge-success badge-sm">Active</div>
               <span class="text-lg">Running</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h3 class="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">Summary</h3>
          <p class="text-base-content mt-2 italic opacity-80 text-lg">
            No execution events recorded yet for this job.
          </p>
        </div>
      </div>
    </div>
  );
};
