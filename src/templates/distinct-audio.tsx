import { DB } from "../db/db";
import { Event, JobLifecycleStatus, JobStatus } from "../events/events";
import { EventList } from "./events-list";
import { Icons } from "./icons";
import { ErrorToast } from "./toast";
import { getAssetPath } from "./utils";

interface DistinctAudioProps {
  showProgress?: boolean;
  jobId?: string;
}

interface DistinctAudioProgressProps {
  jobId: string;
}

interface DistinctAudioActionCardProps {
  showProgress?: boolean;
  jobId?: string;
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

export const DistinctAudio = async ({
  showProgress = false,
  jobId = "",
}: DistinctAudioProps) => {
  return (
    <div className="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
      <ErrorToast />
      <form
        className="flex flex-col xl:flex-row gap-4 xl:h-full"
        hx-post="/api/jobs/audio"
        hx-encoding="multipart/form-data"
        hx-swap="none"
        hx-disable-element="#submit-btn"
        hx-ext={showProgress && jobId ? "sse" : undefined}
        sse-connect={showProgress && jobId ? `/jobs/stream?job_id=${jobId}` : undefined}
      >
        <div className="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex flex-col overflow-hidden min-h-0 xl:h-full resize-none 2xl:resize-x 2xl:min-w-[500px]">
          <div className="card-body flex flex-col p-4 gap-4 flex-grow min-h-0 h-full">
            <div>
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-1">
                <Icons.PromptIcon />
                Prompts
              </h2>
              <p className="text-sm text-base-content/70">
                Shape the arrangement and the lyric intent separately for the ACE 1.5 workflow.
              </p>
            </div>

            <fieldset className="fieldset">
              <legend className="fieldset-legend">Instrumental Prompt</legend>
              <textarea
                name="instrumental_prompt"
                className="textarea textarea-ghost w-full resize-none min-h-[220px] focus:outline-none"
                placeholder="slow burn ambient pop, intimate piano, glassy synths, soft sub bass, restrained percussion, dusk atmosphere"
              ></textarea>
              <p className="label">Describe arrangement, instrumentation, groove, texture, and mood.</p>
            </fieldset>

            <div className="flex flex-col flex-grow min-h-0 h-full gap-2">
              <label for="lyric_prompt" className="fieldset-legend">
                Lyric Prompt
              </label>
              <textarea
                id="lyric_prompt"
                name="lyric_prompt"
                className="textarea textarea-ghost w-full flex-grow h-full resize-none min-h-[420px] focus:outline-none"
                placeholder="Optional. A short hook, imagery, or lyrical concept. Leave blank for purely instrumental output."
              ></textarea>
              <p className="label">Short ideas work better than fully written verses.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col w-full xl:w-[26rem] gap-4 xl:flex-none">
          <div className="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div className="card-body p-4 flex flex-col gap-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.CogSettingsIcon />
                Timing
              </h2>

              <div x-data="{ duration: 60, bpm: 72 }" className="flex flex-col gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Duration</span>
                    <output
                      for="duration_range"
                      className="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[3rem] text-center"
                      x-text="duration + 's'"
                    ></output>
                  </label>
                  <div className="mt-1">
                    <input
                      id="duration_range"
                      type="range"
                      name="duration"
                      value={60}
                      min={10}
                      max={720}
                      step={1}
                      className="range range-primary"
                      x-model="duration"
                    />
                    <div className="flex justify-between text-xs text-base-content/50 mt-1">
                      <span>10s</span>
                      <span>720s</span>
                    </div>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">BPM</span>
                    <output
                      for="bpm_range"
                      className="label-text-alt text-secondary font-bold text-lg px-2 py-1 min-w-[3rem] text-center"
                      x-text="bpm"
                    ></output>
                  </label>
                  <div className="mt-1">
                    <input
                      id="bpm_range"
                      type="range"
                      name="bpm"
                      value={72}
                      min={40}
                      max={240}
                      step={1}
                      className="range range-secondary"
                      x-model="bpm"
                    />
                    <div className="flex justify-between text-xs text-base-content/50 mt-1">
                      <span>40</span>
                      <span>240</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div className="card-body p-4 flex flex-col gap-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.SparkleIcon />
                Generation Controls
              </h2>

              <div x-data="{ cfg: 2, temperature: 0.85, topP: 0.9 }" className="flex flex-col gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">CFG Scale</span>
                    <output
                      for="cfg_scale_range"
                      className="label-text-alt text-accent font-bold text-lg px-2 py-1 min-w-[3rem] text-center"
                      x-text="cfg"
                    ></output>
                  </label>
                  <div className="mt-1">
                    <input
                      id="cfg_scale_range"
                      type="range"
                      name="cfg_scale"
                      value={2}
                      min={0}
                      max={10}
                      step={0.5}
                      className="range range-accent"
                      x-model="cfg"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Temperature</span>
                    <output
                      for="temperature_range"
                      className="label-text-alt text-info font-bold text-lg px-2 py-1 min-w-[3rem] text-center"
                      x-text="Number(temperature).toFixed(2)"
                    ></output>
                  </label>
                  <div className="mt-1">
                    <input
                      id="temperature_range"
                      type="range"
                      name="temperature"
                      value={0.85}
                      min={0}
                      max={2}
                      step={0.05}
                      className="range range-info"
                      x-model="temperature"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Top P</span>
                    <output
                      for="top_p_range"
                      className="label-text-alt text-success font-bold text-lg px-2 py-1 min-w-[3rem] text-center"
                      x-text="Number(topP).toFixed(2)"
                    ></output>
                  </label>
                  <div className="mt-1">
                    <input
                      id="top_p_range"
                      type="range"
                      name="top_p"
                      value={0.9}
                      min={0}
                      max={1}
                      step={0.01}
                      className="range range-success"
                      x-model="topP"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
                <Icons.Audio />
                Musical Framing
              </h2>

              <fieldset className="fieldset">
                <legend className="fieldset-legend">Key / Scale</legend>
                <select name="keyscale" className="select select-bordered w-full">
                  <option value="C major">C major</option>
                  <option value="A minor">A minor</option>
                  <option value="D minor">D minor</option>
                  <option value="E minor" selected>E minor</option>
                  <option value="G major">G major</option>
                  <option value="B minor">B minor</option>
                  <option value="F# minor">F# minor</option>
                </select>
              </fieldset>

                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Time Signature</legend>
                  <div className="join w-full">
                    <input className="btn join-item flex-1" type="radio" name="timesignature" aria-label="2/4" value="2" />
                    <input className="btn join-item flex-1" type="radio" name="timesignature" aria-label="3/4" value="3" />
                    <input className="btn join-item flex-1" type="radio" name="timesignature" aria-label="4/4" value="4" checked />
                    <input className="btn join-item flex-1" type="radio" name="timesignature" aria-label="6/8" value="6" />
                  </div>
                </fieldset>
            </div>
          </div>

          {await (
            <DistinctAudioActionCardFragment
              showProgress={showProgress}
              jobId={jobId}
            />
          )}
        </div>

        <div className="flex flex-col w-full xl:flex-1 gap-4 min-h-[calc(100vh-7rem)]">
          {showProgress && jobId ? <DistinctAudioProgressFragment jobId={jobId} /> : null}

          {showProgress && jobId ? (
            <DistinctAudioGeneratedAudioFragment jobId={jobId} />
          ) : (
            <div className="card bg-base-100 shadow-xl w-full flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3 py-16 px-6 text-center">
                <div className="shrink-0 text-base-content/60">
                  <Icons.Audio />
                </div>
                <h3 className="font-medium text-base-content/60">
                  Generated audio will appear here with an inline player and download action.
                </h3>
              </div>
            </div>
          )}
        </div>
      </form>
      <dialog id="job-action-modal" className="modal"></dialog>
    </div>
  );
};

export const DistinctAudioProgressCard = async ({ jobId }: DistinctAudioProgressProps) => {
  const job = await DB.Jobs.findById(jobId).catch(() => null);
  const statusUi = job ? getJobStatusUi(job.status) : null;

  return (
    <div className="card bg-base-100 shadow-xl w-full max-h-[calc(40vh-3rem)] scrollbar-hide overflow-y-scroll flex-none flex flex-col">
      <div className="card-body flex flex-col p-4">
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
          <p className="text-base font-semibold text-base-content">{job?.name}</p>
          <p className="text-sm text-base-content/70">Monitoring job: {jobId}</p>
        </div>

        <div id="events-container" className="flex-grow">
          {await <EventList jobId={jobId} source="audio-progress" />}
        </div>

        <div className="card-actions justify-end mt-4 flex-none gap-2">
          <button
            className="btn btn-error btn-outline"
            hx-get={`/api/fragments/job-action-modal?jobId=${jobId}&action=cancel&source=audio`}
            hx-target="#job-action-modal"
            hx-swap="outerHTML"
          >
            Cancel
          </button>
          <a href={`/jobs?job_id=${jobId}&filter=all&tab=status`} className="btn btn-primary">
            View Job
          </a>
        </div>
      </div>
    </div>
  );
};

export const DistinctAudioActionCard = async ({
  showProgress = false,
  jobId = "",
}: DistinctAudioActionCardProps) => {
  const activeJob = showProgress && jobId
    ? await DB.Jobs.findById(jobId).catch(() => null)
    : null;
  const isJobRunning = activeJob?.status === JobLifecycleStatus.Active;

  return (
    <div className="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
      <div className="card-body flex flex-col p-4 h-full">
        <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3">
          <Icons.LightningBoltIcon />
          Generate Audio
        </h2>
        <div role="alert" className="alert alert-soft alert-info mb-4">
          <Icons.InfoIcon />
          <span>
            CFG strengthens prompt adherence, Temperature adds variation, and Top P narrows or broadens the token choices.
          </span>
        </div>
        <div className="card-actions justify-between gap-2 mt-auto">
          <button type="reset" className="btn btn-ghost">Reset</button>
          <button type="submit" id="submit-btn" className="btn btn-primary" disabled={isJobRunning}>
            Generate
            <span className="loading loading-spinner loading-md ml-2 hidden htmx-indicator"></span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const DistinctAudioActionCardFragment = async ({
  showProgress = false,
  jobId = "",
}: DistinctAudioActionCardProps) => {
  if (!showProgress || !jobId) {
    return await <DistinctAudioActionCard showProgress={showProgress} jobId={jobId} />;
  }

  return (
    <div
      id="distinct-audio-action-card-fragment"
      className="w-full flex-none flex flex-col min-w-0"
      hx-get={`/jobs/audio-action-card?job_id=${jobId}`}
      hx-trigger="sse:job-update"
      hx-swap="outerHTML"
    >
      {await <DistinctAudioActionCard showProgress={showProgress} jobId={jobId} />}
    </div>
  );
};

export const DistinctAudioProgressFragment = async ({ jobId }: DistinctAudioProgressProps) => {
  return (
    <div
      id="distinct-audio-progress-fragment"
      className="w-full min-w-0 min-h-0 flex flex-col"
      hx-get={`/jobs/audio-progress?job_id=${jobId}`}
      hx-trigger="sse:job-update"
      hx-swap="outerHTML"
    >
      {await <DistinctAudioProgressCard jobId={jobId} />}
    </div>
  );
};

export const GeneratedAudio = async ({ jobId }: DistinctAudioProgressProps) => {
  const events = await DB.Events.findByJobId(jobId);
  const audioEvents: Array<{
    eventId: string;
    filename: string;
    subfolder: string;
    duration?: number;
    prompt: string;
    lyrics?: string;
  }> = [];

  for (const evt of events) {
    if (evt.type !== Event.NewAudioPrompt || evt.status !== JobStatus.Complete) {
      continue;
    }

    const assetMeta = await DB.Meta.findByEventId(evt.id).catch(() => null);
    if (!assetMeta) continue;

    audioEvents.push({
      eventId: evt.id,
      filename: assetMeta.filename,
      subfolder: assetMeta.subfolder,
      duration: evt.duration,
      prompt: evt.prompt,
      lyrics: evt.lyrics,
    });
  }

  if (audioEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <p className="text-lg font-large text-base-content/60">Generating audio</p>
        <span className="loading loading-dots loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {audioEvents.map((audio) => {
        const assetPath = getAssetPath(audio.subfolder, audio.filename);

        return (
          <div key={audio.eventId} className="card bg-base-200 rounded-box border border-base-300">
            <div className="card-body gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="card-title text-base">{audio.filename}</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {audio.duration ? <span className="badge badge-accent">{audio.duration}s</span> : null}
                    <span className="badge badge-soft badge-primary">ACE 1.5</span>
                  </div>
                </div>
                <a href={assetPath} download className="btn btn-primary btn-sm">
                  <Icons.DownloadIconSmall />
                  Download
                </a>
              </div>

              <audio controls className="w-full">
                <source src={assetPath} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>

              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">Instrumental Prompt</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{audio.prompt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">Lyric Prompt</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{audio.lyrics || "[instrumental]"}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const DistinctAudioGeneratedAudioCard = async ({ jobId }: DistinctAudioProgressProps) => {
  return (
    <div className="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] scrollbar-hide overflow-y-scroll xl:flex-1 flex-grow flex flex-col">
      <div className="card-body flex flex-col p-4">
        <h2 className="card-title text-lg font-semibold flex items-center gap-2 mb-3 flex-none">
          <Icons.Audio />
          Generated Audio
        </h2>
        <div className="flex-grow">{await <GeneratedAudio jobId={jobId} />}</div>
      </div>
    </div>
  );
};

export const DistinctAudioGeneratedAudioFragment = async ({ jobId }: DistinctAudioProgressProps) => {
  return (
    <div
      id="distinct-audio-generated-audio-fragment"
      className="w-full xl:flex-1 flex-grow min-w-0 min-h-0 flex flex-col"
      hx-get={`/jobs/generated-audio-card?job_id=${jobId}`}
      hx-trigger="sse:job-update"
      hx-swap="outerHTML"
    >
      {await <DistinctAudioGeneratedAudioCard jobId={jobId} />}
    </div>
  );
};
