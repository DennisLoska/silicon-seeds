import { DB } from "../db/db";
import { JobLifecycleStatus } from "../events/events";
import { EventList } from "./events-list";
import {
  AIModelsCard,
  StylePresetCard,
  VideoSettingsCard,
  VoiceCard,
} from "./generation-settings-cards";
import { Icons } from "./icons";
import { ErrorToast } from "./toast";

interface ComposeProps {
  showProgress?: boolean;
  jobId?: string;
}

interface ComposeProgressProps {
  jobId: string;
}

interface ComposeActionCardProps {
  showProgress?: boolean;
  jobId?: string;
}

function ComposeActionCardBody({ isJobRunning }: { isJobRunning: boolean }) {
  return (
    <div className="card-body flex flex-col h-full">
      <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
        <Icons.LightningBoltIcon />
        Action!
      </h2>
      <div className="card-actions justify-between flex flex-row gap-2 mt-auto">
        <button type="reset" className="btn btn-ghost">
          Reset
        </button>
        <button
          type="submit"
          id="submit-btn"
          className="btn btn-primary"
          disabled={isJobRunning}
        >
          Generate Video
          <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
        </button>
      </div>
    </div>
  );
}

function getJobStatusUi(status?: JobLifecycleStatus) {
  switch (status) {
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
}

export const Compose = async ({
  showProgress = false,
  jobId = "",
}: ComposeProps) => {
  return (
    <div className="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
      <ErrorToast />
      {/* Kanban-style Card Container */}
      <form
        className="flex flex-col xl:flex-row gap-4 xl:h-full"
        hx-post="/api/jobs/videos/compose"
        hx-encoding="multipart/form-data"
        hx-swap="none"
        hx-disable-element="#submit-btn"
        hx-ext={showProgress && jobId ? "sse" : undefined}
        sse-connect={
          showProgress && jobId ? `/jobs/stream?job_id=${jobId}` : undefined
        }
        hx-on={`
        before-request(this) {
          this.querySelector('.submit-toggle').checked = true;
        }
        after-request(this) {
          this.querySelector('.submit-toggle').checked = false;
        }
      `}
      >
        {/* First column: Video Script + Style Guide */}
        <div className="flex flex-col gap-4 w-full xl:w-1/2 2xl:w-1/3 2xl:min-w-[500px]">
          <div className="card bg-base-100 shadow-xl flex flex-col overflow-hidden resize-none">
            <div className="card-body flex flex-col flex-grow p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
                <Icons.DocumentIcon />
                Video Script
              </h2>
              <textarea
                name="script"
                id="type-script-tab"
                className="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[420px] focus:outline-none"
                placeholder="Write your video script here..."
              ></textarea>

              {/* Divider */}
              <div className="divider my-2 flex-none">OR</div>

              {/* File upload input */}
              <input
                type="file"
                name="script_file"
                accept=".txt,.md"
                className="file-input file-input-bordered w-full flex-none"
              />
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl flex-none">
            <div className="card-body flex flex-col p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
                <Icons.PaintBrushIcon />
                Style Guide
              </h2>
              <textarea
                name="style_guide"
                id="style-guide"
                maxLength={2000}
                rows={7}
                style={{ minHeight: "180px", maxHeight: "320px" }}
                className="textarea textarea-bordered w-full resize-y"
                placeholder={`Define consistent style across all images...\n• warm ochre palette\n• watercolor texture\n• ancient Egypt only - no modern items\n• consistent character appearance`}
              ></textarea>
              <p className="text-xs text-base-content/60 mt-2">
                Defines stylistic coherence across all generated images. Applied in addition to Style Preset.
              </p>
            </div>
          </div>
        </div>

        {/* Container for Cards 2-4 - Stacked vertically, takes half width and full height */}
        <div className="flex flex-col w-full xl:w-1/2 gap-4 flex-grow">
          <AIModelsCard />
          <VideoSettingsCard />
          <StylePresetCard />

          {/* Card: Voice Selection */}
          <VoiceCard />

          {/* Card 5: Action Buttons */}
          {await (
            <ComposeActionCardFragment
              showProgress={showProgress}
              jobId={jobId}
            />
          )}
        </div>

        {/* Card 6: Progress - Only shown when showProgress=true */}
        {showProgress && jobId && <ComposeProgressFragment jobId={jobId} />}
      </form>
      <dialog id="job-action-modal" className="modal"></dialog>
    </div>
  );
};

export const ComposeProgressCard = async ({ jobId }: ComposeProgressProps) => {
  const job = await DB.Jobs.findById(jobId).catch(() => null);
  const statusUi = job ? getJobStatusUi(job.status) : null;

  return (
    <div className="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] scrollbar-hide overflow-y-scroll flex flex-col">
      <div className="card-body flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="card-title text-lg font-semibold flex items-center gap-2">
            <Icons.PulseWavesIcon />
            Job Progress
          </h2>
          {statusUi ? (
            <span className={`badge badge-xl ${statusUi.badge}`}>
              <statusUi.Icon />
              {statusUi.label}
            </span>
          ) : null}
        </div>
        <div className="mb-4 flex-none space-y-1">
          <p className="text-base font-semibold text-base-content">
            {job?.name}
          </p>
          <p className="text-sm text-base-content/70">
            Monitoring job: {jobId}
          </p>
        </div>
        <div id="events-container" className="flex-grow min-h-[300px]">
          {await (<EventList jobId={jobId} source="compose-progress" />)}
        </div>

        <div className="card-actions justify-end mt-4 flex-none gap-2">
          <button
            className="btn btn-error btn-outline"
            hx-get={`/api/fragments/job-action-modal?jobId=${jobId}&action=cancel&source=compose`}
            hx-target="#job-action-modal"
            hx-swap="outerHTML"
          >
            Cancel
          </button>
          <a
            href={`/jobs?job_id=${jobId}&filter=all&tab=status`}
            className="btn btn-primary"
          >
            View Job
          </a>
        </div>
      </div>
    </div>
  );
};

export const ComposeActionCard = async ({
  showProgress = false,
  jobId = "",
}: ComposeActionCardProps) => {
  const activeJob =
    showProgress && jobId
      ? await DB.Jobs.findById(jobId).catch(() => null)
      : null;
  const isJobRunning = activeJob?.status === JobLifecycleStatus.Active;

  return (
    <div className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col">
      <ComposeActionCardBody isJobRunning={isJobRunning} />
    </div>
  );
};

export const ComposeActionCardFragment = async ({
  showProgress = false,
  jobId = "",
}: ComposeActionCardProps) => {
  const activeJob =
    showProgress && jobId
      ? await DB.Jobs.findById(jobId).catch(() => null)
      : null;
  const isJobRunning = activeJob?.status === JobLifecycleStatus.Active;

  if (!showProgress || !jobId) {
    return await (
      <ComposeActionCard showProgress={showProgress} jobId={jobId} />
    );
  }

  return (
    <div
      id="compose-action-card-fragment"
      className="card bg-base-100 shadow-xl w-full 2xl:max-w-[calc(12.5vw)] 2xl:min-w-80 min-w-0 flex-grow flex flex-col"
      hx-get={`/jobs/compose-action-card?job_id=${jobId}`}
      hx-trigger="sse:job-update"
      hx-swap="outerHTML"
    >
      <ComposeActionCardBody isJobRunning={isJobRunning} />
    </div>
  );
};

export const ComposeProgressFragment = async ({
  jobId,
}: ComposeProgressProps) => {
  return (
    <div
      id="compose-progress-fragment"
      className="w-full xl:w-1/2 2xl:w-1/3 min-w-0 min-h-0 flex flex-col"
      hx-get={`/jobs/compose-progress?job_id=${jobId}`}
      hx-trigger="sse:job-update"
      hx-swap="outerHTML"
    >
      {await (<ComposeProgressCard jobId={jobId} />)}
    </div>
  );
};
