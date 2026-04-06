import { DB } from "../db/db";
import { Job } from "../events/events";
import { STATUS_ICONS } from "./icons";

const EMPTY_STATE = (
  <div className="card bg-base-200 shadow-sm">
    <div className="card-body">
      <h2 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
        Summary
      </h2>
      <p className="text-base-content mt-2 italic opacity-80 text-lg">
        No events have been logged for this job yet.
      </p>
    </div>
  </div>
);

function calculateJobDuration(job: Job, events: any[]): string {
  if (events.length === 0) return "0h 0m 0s";

  const lastEvent = [...events].sort(
    (a, b) =>
      new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
  )[0];
  if (!lastEvent?.created_at) return "0h 0m 0s";

  const durationMs =
    new Date(lastEvent.created_at).getTime() -
    new Date(job.created_at).getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor(
    (durationMs % (1000 * 60 * 60)) / (1000 * 60),
  );
  const durationSeconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  return `${durationHours}h ${durationMinutes}m ${durationSeconds}s`;
}

export const status = async (job: Job) => {
  const events = await DB.Events.findByJobId(job.id);
  const isCompleted = events.some((e) => e.status === "complete");
  const completedCount = events.filter((e) => e.status === "complete").length;
  const durationStr = calculateJobDuration(job, events);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-base-content">
          Status{" "}
          <span
            className={`badge badge-xl ${isCompleted ? "badge-success" : "badge-warning"}`}
          >
            {STATUS_ICONS[isCompleted ? "complete" : "pending"]}
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
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Events
            </div>
            <div className="stat-value text-lg">
              {completedCount} / {events.length}
            </div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Duration
            </div>
            <div className="stat-value text-lg">{durationStr}</div>
          </div>
        </div>
      </div>
      {events.length > 0 ? (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Summary
            </h2>
            <p className="text-base-content mt-2 italic opacity-80 text-lg">
              Job has {events.length} event(s).
            </p>
          </div>
        </div>
      ) : (
        EMPTY_STATE
      )}
    </div>
  );
};

