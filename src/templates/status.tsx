import { DB } from "../db/db";
import { Event, Job, JobLifecycleStatus, JobStatus } from "../events/events";
import { Icons } from "./icons";

const EmptyState = () => (
  <div className="card bg-base-200 shadow-sm">
    <div className="card-body">
      <p className="text-base-content italic opacity-80 text-lg">
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

function formatLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value);
}

function formatSeconds(value?: number | null) {
  if (value === undefined || value === null) return "Not set";
  return `${value}s`;
}

function humanizeEventType(type: Event) {
  switch (type) {
    case Event.NewTextPrompt:
      return "Script";
    case Event.NewAudioPrompt:
      return "Audio";
    case Event.NewImagePrompt:
      return "Image";
    case Event.NewVideoPrompt:
      return "Video";
    case Event.NewTransitionPrompt:
      return "Transition";
    case Event.NewVideoComposition:
      return "Composition";
    default:
      return type;
  }
}

export const Status = async (job: Job) => {
  const events = await DB.Events.findByJobIdChronological(job.id);
  const completedCount = events.filter(
    (e) => e.status === JobStatus.Complete,
  ).length;
  const runningCount = events.filter((e) => e.status === JobStatus.Running).length;
  const pendingCount = events.filter((e) => e.status === JobStatus.Pending).length;
  const failedCount = events.filter((e) => e.status === JobStatus.Failed).length;
  const durationStr = calculateJobDuration(job, events);
  const progressValue = events.length === 0 ? 0 : Math.round((completedCount / events.length) * 100);
  const runningEvent = events.find((e) => e.status === JobStatus.Running) ?? null;
  const imageCount = events.filter((e) => e.type === Event.NewImagePrompt).length;
  const videoCount = events.filter((e) => e.type === Event.NewVideoPrompt).length;
  const transitionCount = events.filter((e) => e.type === Event.NewTransitionPrompt).length;
  const audioCount = events.filter((e) => e.type === Event.NewAudioPrompt).length;

  const statusUi = (() => {
    switch (job.status) {
      case JobLifecycleStatus.Complete:
        return {
          label: "Complete",
          badge: "badge-success",
          Icon: Icons.StatusComplete,
        };
      case JobLifecycleStatus.Failed:
        return {
          label: "Failed",
          badge: "badge-error",
          Icon: Icons.StatusFailed,
        };
      case JobLifecycleStatus.Cancelled:
        return {
          label: "Cancelled",
          badge: "badge-neutral",
          Icon: Icons.StatusCancelled,
        };
      default:
        return {
          label: "Active",
          badge: "badge-warning",
          Icon: Icons.StatusPending,
        };
    }
  })();

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-base-content">
            Status{" "}
            <span className={`badge badge-xl ${statusUi.badge}`}>
              <statusUi.Icon />
              {statusUi.label}
            </span>
          </h2>
          <p className="text-base-content/60 mt-1">
            Detailed overview of job execution and configuration.
          </p>
        </div>
        {job.status === JobLifecycleStatus.Active ? (
          <button
            className="btn btn-error btn-sm lg:btn-md"
            hx-get={`/api/fragments/job-action-modal?jobId=${job.id}&action=cancel&source=jobs`}
            hx-target="#job-action-modal"
            hx-swap="outerHTML"
          >
            <Icons.StatusCancelledSmall />
            Cancel Job
          </button>
        ) : null}
      </header>
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Progress
            </h3>
            <span className="font-bold text-base-content">{progressValue}%</span>
          </div>
          <progress className="progress progress-primary w-full" value={progressValue} max="100"></progress>
          <p className="text-sm text-base-content/70">
            {completedCount} of {events.length} events complete.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
              {new Date(job.created_at).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Job Status
            </div>
            <div className="stat-value text-lg">{statusUi.label}</div>
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
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Running
            </div>
            <div className="stat-value text-lg">{runningCount}</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Pending
            </div>
            <div className="stat-value text-lg">{pendingCount}</div>
          </div>
        </div>
        <div className="stats shadow bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs uppercase opacity-60 font-bold tracking-widest">
              Failed
            </div>
            <div className="stat-value text-lg">{failedCount}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Render Settings
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-base-content/60">Resolution</div>
                <div className="font-semibold">{formatLabel(job.resolution)}</div>
              </div>
              <div>
                <div className="text-base-content/60">FPS</div>
                <div className="font-semibold">{formatLabel(job.fps)}</div>
              </div>
              <div>
                <div className="text-base-content/60">Clip Duration</div>
                <div className="font-semibold">{formatSeconds(job.clip_duration)}</div>
              </div>
              <div>
                <div className="text-base-content/60">Transition Duration</div>
                <div className="font-semibold">{formatSeconds(job.transition_duration)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Models
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-base-content/60">Image Model</div>
                <div className="font-semibold">{formatLabel(job.image_model)}</div>
              </div>
              <div>
                <div className="text-base-content/60">Video Model</div>
                <div className="font-semibold">{formatLabel(job.video_model)}</div>
              </div>
              <div>
                <div className="text-base-content/60">Style Preset</div>
                <div className="font-semibold">{formatLabel(job.style_preset)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Pipeline
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-base-content/60">Audio Events</div>
                <div className="font-semibold">{audioCount}</div>
              </div>
              <div>
                <div className="text-base-content/60">Image Events</div>
                <div className="font-semibold">{imageCount}</div>
              </div>
              <div>
                <div className="text-base-content/60">Video Events</div>
                <div className="font-semibold">{videoCount}</div>
              </div>
              <div>
                <div className="text-base-content/60">Transitions</div>
                <div className="font-semibold">{transitionCount}</div>
              </div>
            </div>
            <div className="divider my-1"></div>
            <div className="text-sm">
              <div className="text-base-content/60">Current Step</div>
              <div className="font-semibold">
                {runningEvent ? humanizeEventType(runningEvent.type) : "Idle"}
              </div>
            </div>
          </div>
        </div>
      </div>
      {events.length === 0 ? <EmptyState /> : null}
    </div>
  );
};
