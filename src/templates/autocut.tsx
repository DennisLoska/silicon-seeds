import {
  AutoCutWorkflow,
  type AutoCutStage,
  type AutoCutState,
} from "../autocut/autocut-workflow";
import { Icons } from "./icons";

interface AutoCutProps {
  showProgress?: boolean;
  jobId?: string;
}

interface AutoCutStatusProps {
  jobId: string;
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
    case "extracting_audio":
      return "Extracting audio";
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

const FILE_PICKER_PLACEHOLDER = "No file chosen";

function AutoCutEmptyState() {
  return (
    <div className="card bg-base-100 shadow-xl w-full xl:flex-1">
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

function AutoCutStatusContent({ state }: { state: AutoCutState | null }) {
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
    <div className="card bg-base-100 shadow-xl w-full xl:flex-1">
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
            <div className="space-y-2">
              <h3 className="font-semibold">Removal Spans</h3>
              {state.removals && state.removals.length > 0 ? (
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.removals.map((removal, index) => (
                        <tr key={`${removal.start}-${removal.end}-${index}`}>
                          <td>
                            <span className="badge badge-outline">
                              {removal.reason}
                            </span>
                          </td>
                          <td>{formatSeconds(removal.start)}</td>
                          <td>{formatSeconds(removal.end)}</td>
                          <td className="max-w-xl whitespace-pre-wrap break-words">
                            {removal.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-base-content/70">
                  No removable spans were detected.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {isProcessing ? (
          <div className="flex items-center gap-3 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-sm text-primary"></span>
            Polling for updates every 5 seconds.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const AutoCutStatusFragment = async ({ jobId }: AutoCutStatusProps) => {
  const state = await AutoCutWorkflow.readState(jobId);
  const shouldPoll = state?.stage !== "complete" && state?.stage !== "failed";

  return (
    <div
      id="autocut-status-fragment"
      className="w-full xl:flex-1 min-w-0"
      hx-get={shouldPoll ? `/create/autocut/status?job_id=${jobId}` : undefined}
      hx-trigger={shouldPoll ? "load delay:5s, every 5s" : undefined}
      hx-swap={shouldPoll ? "outerHTML" : undefined}
    >
      <AutoCutStatusContent state={state} />
    </div>
  );
};

export const AutoCut = async ({
  showProgress = false,
  jobId = "",
}: AutoCutProps) => {
  return (
    <div className="flex flex-col gap-4 sm:px-6 py-6 xl:h-full bg-base-200">
      <div className="grid gap-4 xl:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)] xl:items-start">
        <div className="card bg-base-100 shadow-xl w-full min-w-0">
          <form
            className="card-body gap-5 w-full min-w-0"
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
              >
                Start AutoCut
                <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
              </button>
            </div>
          </form>
        </div>

        {showProgress && jobId ? (
          <AutoCutStatusFragment jobId={jobId} />
        ) : (
          <AutoCutEmptyState />
        )}
      </div>
    </div>
  );
};
