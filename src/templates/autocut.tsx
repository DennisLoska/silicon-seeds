import {
  AutoCutWorkflow,
  type AutoCutCutClip,
  type AutoCutStage,
  type AutoCutState,
} from "../autocut/autocut-workflow";
import { DB } from "../db/db";
import { Event, JobLifecycleStatus, JobStatus } from "../events/events";
import {
  AIModelsCard,
  StylePresetCard,
  VideoSettingsCard,
} from "./generation-settings-cards";
import { Icons } from "./icons";
import { getAssetPath } from "./utils";

interface AutoCutProps {
  showProgress?: boolean;
  jobId?: string;
}

interface AutoCutStatusProps {
  jobId: string;
}

interface AutoCutInsertProgressRow {
  id: string;
  index: number;
  kind: "image" | "video" | "transition";
  label: string;
  status: JobStatus;
  assetPath?: string;
  prompt: string;
}

function badgeForStage(stage?: AutoCutStage) {
  switch (stage) {
    case "complete":
      return "badge-success";
    case "failed":
      return "badge-error";
    default:
      return "badge-warning";
  }
}

function stageLabel(stage?: AutoCutStage) {
  switch (stage) {
    case "transcribing":
      return "Transcribing";
    case "analyzing":
      return "Analyzing transcript";
    case "rendering":
      return "Rendering cut";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    case "queued":
    default:
      return "Queued";
  }
}

function formatSeconds(value?: number) {
  if (value === undefined) return "n/a";
  return `${value.toFixed(2)}s`;
}

function progressBadge(status: JobStatus) {
  switch (status) {
    case JobStatus.Complete:
      return "badge-success";
    case JobStatus.Running:
      return "badge-warning";
    case JobStatus.Failed:
      return "badge-error";
    case JobStatus.Pending:
    default:
      return "badge-ghost";
  }
}

function progressLabel(status: JobStatus) {
  switch (status) {
    case JobStatus.Complete:
      return "Complete";
    case JobStatus.Running:
      return "Running";
    case JobStatus.Failed:
      return "Failed";
    case JobStatus.Pending:
    default:
      return "Pending";
  }
}

function summarizeCutClip(clip: AutoCutCutClip) {
  const reasons = Array.from(new Set(clip.removals.map((removal) => removal.reason))).join(", ");
  const text = clip.removals
    .map((removal) => removal.text.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .join(" ");

  return {
    reasons: reasons || "n/a",
    text: text || "[no transcript text]",
  };
}

function hasClipAsset(clip: AutoCutCutClip) {
  return Boolean(clip.outputAssetPath);
}

const FILE_PICKER_PLACEHOLDER = "No file chosen";

async function loadInsertProgress(jobId: string): Promise<AutoCutInsertProgressRow[]> {
  const events = await DB.Events.findByJobId(jobId).catch(() => []);
  const mediaEvents = events.filter(
    (event): event is Extract<
      (typeof events)[number],
      | { type: Event.NewImagePrompt }
      | { type: Event.NewVideoPrompt }
      | { type: Event.NewTransitionPrompt }
    > =>
      event.type === Event.NewImagePrompt ||
      event.type === Event.NewVideoPrompt ||
      event.type === Event.NewTransitionPrompt,
  );

  const rows = await Promise.all(mediaEvents.map(async (event) => {
    const meta = event.status === JobStatus.Complete
      ? await DB.Meta.findByEventId(event.id).catch(() => null)
      : null;

    if (event.type === Event.NewImagePrompt) {
      return {
        id: event.id,
        index: event.index ?? 0,
        kind: "image" as const,
        label: `Insert ${String((event.index ?? 0) + 1).padStart(2, "0")}`,
        status: event.status,
        assetPath: meta ? getAssetPath(meta.subfolder, meta.filename) : undefined,
        prompt: event.prompt,
      };
    }

    if (event.type === Event.NewVideoPrompt) {
      return {
        id: event.id,
        index: event.index ?? 0,
        kind: "video" as const,
        label: `Insert ${String((event.index ?? 0) + 1).padStart(2, "0")}`,
        status: event.status,
        assetPath: meta ? getAssetPath(meta.subfolder, meta.filename) : undefined,
        prompt: event.prompt,
      };
    }

    return {
      id: event.id,
      index: Number.MAX_SAFE_INTEGER,
      kind: "transition" as const,
      label: event.prompt.includes("back into the real source footage")
        ? "Outgoing transition"
        : "Incoming transition",
      status: event.status,
      assetPath: meta ? getAssetPath(meta.subfolder, meta.filename) : undefined,
      prompt: event.prompt,
    };
  }));

  return rows.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    const kindOrder = { image: 0, video: 1, transition: 2 };
    return kindOrder[a.kind] - kindOrder[b.kind];
  });
}

function AutoCutEmptyState() {
  return (
    <div className="card bg-base-100 shadow-xl w-full xl:flex-1 flex-grow min-h-[calc(100vh-7rem)]">
      <div className="card-body items-center justify-center text-center gap-4 py-16">
        <div className="text-primary">
          <Icons.AutoCutSmall />
        </div>
        <div className="space-y-2 max-w-xl">
          <h2 className="text-xl font-semibold">Upload a source video</h2>
          <p className="text-base-content/70">
            AutoCut reviews your video and prepares a cleaner edit with less
            dead air and fewer rough takes.
          </p>
        </div>
      </div>
    </div>
  );
}

function AutoCutStatusContent({
  state,
  insertProgress,
}: {
  state: AutoCutState | null;
  insertProgress: AutoCutInsertProgressRow[];
}) {
  if (!state) {
    return (
      <div role="alert" className="alert alert-soft alert-warning">
        <Icons.InfoIcon />
        <span>No autocut run found for the requested job.</span>
      </div>
    );
  }

  const isProcessing = state.stage !== "complete" && state.stage !== "failed";

  return (
    <div className="card bg-base-100 shadow-xl w-full xl:flex-1 flex-grow min-h-[calc(100vh-7rem)]">
      <div className="card-body gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="card-title text-lg">AutoCut Status</h2>
            <p className="text-sm text-base-content/70">Run {state.jobId}</p>
          </div>
          <span className={`badge badge-lg ${badgeForStage(state.stage)}`}>
            {stageLabel(state.stage)}
          </span>
        </div>

        <div className="stats stats-vertical lg:stats-horizontal shadow-sm bg-base-200">
          <div className="stat">
            <div className="stat-title">Source</div>
            <div className="stat-value text-base">{state.inputFilename}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Transcript Words</div>
            <div className="stat-value text-base">
              {state.transcriptWordCount ?? 0}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Removed</div>
            <div className="stat-value text-base">
              {state.removalCount ?? 0}
            </div>
            <div className="stat-desc">
              {formatSeconds(state.removedDurationSeconds)}
            </div>
          </div>
        </div>

        <div
          role="alert"
          className={`alert ${state.stage === "failed" ? "alert-error" : "alert-soft alert-info"}`}
        >
          <Icons.InfoIcon />
          <span>{state.error ?? state.message}</span>
        </div>

        {state.warnings && state.warnings.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-semibold">Warnings</h3>
            <ul className="list bg-base-200 rounded-box">
              {state.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`} className="list-row text-sm">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.stage === "complete" && state.outputVideoAssetPath ? (
          <div className="space-y-4">
            <video
              controls
              className="w-full rounded-box bg-black"
              src={state.outputVideoAssetPath}
            ></video>
            <div className="flex flex-wrap gap-2">
              <a
                className="btn btn-primary"
                href={state.outputVideoAssetPath}
                download
              >
                <Icons.DownloadIconSmall />
                Download Final Cut
              </a>
            </div>
          </div>
        ) : null}

        {state.cutClips && state.cutClips.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold">Cut Clips</h3>
                <p className="text-xs text-base-content/60">
                  Hover a preview to watch and hear the removed snippet.
                </p>
              </div>
              <div className="badge badge-soft badge-neutral">
                {state.cutClips.length} saved snippets
              </div>
            </div>
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200/60 shadow-sm">
              <table className="table table-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.14em] text-base-content/50">
                    <th className="bg-base-200">#</th>
                    <th className="bg-base-200">Range</th>
                    <th className="bg-base-200">Reasons</th>
                    <th className="bg-base-200">Transcript</th>
                    <th className="bg-base-200 text-right">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {state.cutClips.map((clip) => {
                    const summary = summarizeCutClip(clip);
                    return (
                      <tr
                        key={`${clip.index}-${clip.start}-${clip.end}`}
                        className="hover:bg-base-100/80 transition-colors"
                      >
                        <td className="align-top">
                          <div className="badge badge-outline badge-sm font-mono">
                            {clip.index + 1}
                          </div>
                        </td>
                        <td className="align-top">
                          <div className="flex min-w-36 flex-col gap-1 text-xs">
                            <div className="flex items-center gap-2 font-mono text-base-content/80">
                              <span className="rounded bg-base-100 px-2 py-1">
                                {formatSeconds(clip.start)}
                              </span>
                              <span className="text-base-content/40">to</span>
                              <span className="rounded bg-base-100 px-2 py-1">
                                {formatSeconds(clip.end)}
                              </span>
                            </div>
                            <div className="text-base-content/50">
                              {formatSeconds(clip.durationSeconds)} removed
                            </div>
                          </div>
                        </td>
                        <td className="align-top">
                          <div className="flex max-w-40 flex-wrap gap-1">
                            {summary.reasons.split(", ").map((reason) => (
                              <span
                                key={`${clip.index}-${reason}`}
                                className="badge badge-soft badge-warning badge-sm"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-xl align-top whitespace-pre-wrap break-words text-sm leading-5 text-base-content/80">
                          {summary.text}
                        </td>
                        <td className="align-top text-right">
                          {hasClipAsset(clip) ? (
                            <video
                              className="ml-auto h-14 w-24 rounded-lg border border-base-300 bg-black object-cover shadow-sm"
                              src={clip.outputAssetPath}
                              loop
                              playsinline
                              preload="metadata"
                              onmouseenter="this.currentTime = 0; this.play()"
                              onmouseleave="this.pause(); this.currentTime = 0"
                            ></video>
                          ) : (
                            <span className="text-xs text-base-content/50">Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {insertProgress.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold">Generated Inserts</h3>
                <p className="text-xs text-base-content/60">
                  Live progress for insert images, clips, and transitions.
                </p>
              </div>
              <div className="badge badge-soft badge-primary">
                {insertProgress.filter((row) => row.status === JobStatus.Complete).length}/{insertProgress.length} complete
              </div>
            </div>
            <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200/60 shadow-sm">
              <table className="table table-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.14em] text-base-content/50">
                    <th className="bg-base-200">Item</th>
                    <th className="bg-base-200">Type</th>
                    <th className="bg-base-200">Status</th>
                    <th className="bg-base-200">Preview</th>
                    <th className="bg-base-200">Prompt</th>
                  </tr>
                </thead>
                <tbody>
                  {insertProgress.map((row) => (
                    <tr key={row.id} className="hover:bg-base-100/80 transition-colors">
                      <td className="align-top font-medium">{row.label}</td>
                      <td className="align-top">
                        <span className="badge badge-outline badge-sm uppercase">
                          {row.kind}
                        </span>
                      </td>
                      <td className="align-top">
                        <span className={`badge badge-sm ${progressBadge(row.status)}`}>
                          {progressLabel(row.status)}
                        </span>
                      </td>
                      <td className="align-top">
                        {row.assetPath ? (
                          row.kind === "image" ? (
                            <img
                              className="h-12 w-20 rounded-lg border border-base-300 bg-black object-cover"
                              src={row.assetPath}
                              alt={row.label}
                            />
                          ) : (
                            <video
                              className="h-12 w-20 rounded-lg border border-base-300 bg-black object-cover"
                              src={row.assetPath}
                              muted
                              playsinline
                              preload="metadata"
                            ></video>
                          )
                        ) : (
                          <span className="text-xs text-base-content/50">Waiting</span>
                        )}
                      </td>
                      <td className="max-w-xl align-top whitespace-pre-wrap break-words text-sm leading-5 text-base-content/80">
                        {row.prompt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {isProcessing ? (
          <div className="flex items-center gap-3 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-sm text-primary"></span>
            Polling for updates every 5 seconds.
          </div>
        ) : null}

        <div className="card-actions justify-end mt-4 flex-none gap-2">
          <button
            className="btn btn-error btn-outline"
            hx-get={`/api/fragments/job-action-modal?jobId=${state.jobId}&action=cancel&source=autocut`}
            hx-target="#job-action-modal"
            hx-swap="outerHTML"
          >
            Cancel
          </button>
          <a
            href={`/jobs?job_id=${state.jobId}&filter=all&tab=status`}
            className="btn btn-primary"
          >
            View Job
          </a>
        </div>
      </div>
    </div>
  );
}

export const AutoCutStatusFragment = async ({ jobId }: AutoCutStatusProps) => {
  const state = await AutoCutWorkflow.readState(jobId);
  const insertProgress = await loadInsertProgress(jobId);
  const shouldPoll = state?.stage !== "complete" && state?.stage !== "failed";

  return (
    <div
      id="autocut-status-fragment"
      className="w-full xl:flex-1 min-w-0"
      hx-get={shouldPoll ? `/create/autocut/status?job_id=${jobId}` : undefined}
      hx-trigger={shouldPoll ? "load delay:5s, every 5s" : undefined}
      hx-swap={shouldPoll ? "outerHTML" : undefined}
    >
      <AutoCutStatusContent state={state} insertProgress={insertProgress} />
    </div>
  );
};

export const AutoCut = async ({
  showProgress = false,
  jobId = "",
}: AutoCutProps) => {
  const currentJob = showProgress && jobId
    ? await DB.Jobs.findById(jobId).catch(() => null)
    : null;
  const isJobRunning = currentJob?.status === JobLifecycleStatus.Active;

  return (
    <div className="flex flex-col gap-4 sm:px-6 py-6 xl:h-full bg-base-200">
      <form
        className="flex flex-col xl:flex-row xl:items-start gap-4 xl:h-full"
        x-data="{ generateInsertClips: false }"
        hx-post="/api/jobs/videos/autocut"
        hx-encoding="multipart/form-data"
        hx-swap="none"
        hx-disable-element="#autocut-submit-btn"
        hx-on={`
          after-request(this, event) {
            const redirect = event.detail.xhr.getResponseHeader('HX-Redirect');
            if (redirect) {
              window.location.href = redirect;
            }
          }
          validation:halted(this) {
            this.reportValidity();
          }
        `}
      >
        <div className="card bg-base-100 shadow-xl w-full xl:w-[30rem] xl:flex-none min-w-0">
          <div className="card-body gap-5 w-full min-w-0">
            <div className="space-y-2">
              <h2 className="card-title text-lg flex items-center gap-2">
                <Icons.AutoCutSmall />
                AutoCut
              </h2>
              <p className="text-sm text-base-content/70">
                Upload a video and let AutoCut clean up the edit automatically.
              </p>
            </div>

            <fieldset className="fieldset w-full min-w-0">
              <legend className="fieldset-legend">Video Upload</legend>
              <label className="relative box-border flex w-full max-w-full min-w-0 cursor-pointer items-stretch overflow-hidden rounded-box border border-base-300 bg-base-100">
                <input
                  type="file"
                  name="video_file"
                  accept="video/*,.mp4,.mov,.mkv,.webm"
                  className="absolute inset-0 opacity-0"
                  required
                  onchange={`this.nextElementSibling.nextElementSibling.textContent = this.files?.[0]?.name || '${FILE_PICKER_PLACEHOLDER}'`}
                />
                <span className="pointer-events-none flex shrink-0 items-center bg-primary px-4 text-sm font-medium text-primary-content">
                  Choose video
                </span>
                <span className="min-w-0 max-w-full flex-1 px-4 py-3 whitespace-normal break-all text-sm text-base-content/70">
                  {FILE_PICKER_PLACEHOLDER}
                </span>
              </label>
              <p className="label">
                Supported formats: .mp4, .mov, .mkv, .webm
              </p>
            </fieldset>

            <fieldset className="fieldset w-full min-w-0">
              <legend className="fieldset-legend">Options</legend>
              <input type="hidden" name="generate_insert_clips" value="false" />
              <label className="label cursor-pointer justify-start gap-3 rounded-box border border-base-300 px-4 py-3">
                <input
                  type="checkbox"
                  name="generate_insert_clips"
                  value="true"
                  className="checkbox checkbox-primary"
                  x-model="generateInsertClips"
                />
                <span className="text-sm">
                  Generate optional insert clips and transitions
                </span>
              </label>
              <p className="label">
                Enable to customize AI-generated insert clips.
              </p>
            </fieldset>

            <div role="alert" className="alert alert-soft alert-info">
              <Icons.InfoIcon />
              <span>
                AutoCut removes pauses, filler words, and rough retakes for a
                cleaner result.
              </span>
            </div>

            <div className="card-actions justify-between">
              <button type="reset" className="btn btn-ghost">
                Reset
              </button>
              <button
                type="submit"
                id="autocut-submit-btn"
                className="btn btn-primary"
                disabled={isJobRunning}
              >
                {isJobRunning ? "AutoCut Running" : "Start AutoCut"}
                <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
              </button>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 xl:w-[24rem] xl:flex-none xl:flex xl:flex-col xl:gap-4">
          <div x-show="!generateInsertClips"></div>
          <div
            className="min-w-0 xl:flex xl:flex-col xl:gap-4"
            x-show="generateInsertClips"
          >
            <AIModelsCard
              className="w-full min-w-0"
              disabledExpr="!generateInsertClips"
            />
            <VideoSettingsCard
              className="w-full min-w-0"
              disabledExpr="!generateInsertClips"
            />
            <StylePresetCard
              className="w-full min-w-0"
              disabledExpr="!generateInsertClips"
            />
          </div>
        </div>

        <div className="min-w-0 xl:flex-1 flex-grow min-h-[calc(100vh-7rem)] flex">
          {showProgress && jobId ? (
            <AutoCutStatusFragment jobId={jobId} />
          ) : (
            <AutoCutEmptyState />
          )}
        </div>
      </form>
      <dialog id="job-action-modal" className="modal"></dialog>
    </div>
  );
};
