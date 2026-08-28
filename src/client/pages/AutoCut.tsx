import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet } from "../api/client";
import { Icons } from "../components/Icons";

export default function AutoCut() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

  const [generateInsertClips, setGenerateInsertClips] = createSignal(false);
  const [fps, setFps] = createSignal(16);
  const [clipDuration, setClipDuration] = createSignal(5);
  const [transitionDuration, setTransitionDuration] = createSignal(3);
  const [fileName, setFileName] = createSignal("No file chosen");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [eventsData, { refetch }] = createResource(
    () => (showProgress() ? jobId() : undefined),
    async (id) => {
      if (!id) return { events: [] as unknown[] };
      try {
        const d = await apiGet<{ events: unknown[] }>(`/api/jobs/${id}/events?limit=30`);
        return d;
      } catch {
        return { events: [] };
      }
    },
  );
  useJobUpdates(jobId, () => refetch());

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    // ensure generate_insert_clips boolean string
    fd.set("generate_insert_clips", generateInsertClips() ? "true" : "false");
    try {
      const res = await fetch("/api/jobs/videos/autocut", { method: "POST", body: fd });
      if (!res.ok) {
        setError((await res.text()).slice(0, 600));
        setIsSubmitting(false);
        return;
      }
      const redirect = res.headers.get("HX-Redirect");
      if (redirect) {
        const url = new URL(redirect, window.location.origin);
        const jid = url.searchParams.get("job_id");
        if (jid) {
          setSearch({ show_progress: "true", job_id: jid });
          navigate(`/create/autocut?show_progress=true&job_id=${jid}`);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col xl:flex-row xl:items-start gap-4 sm:px-6 py-6 xl:h-full bg-base-200">
      <Show when={error()}>
        <div class="alert alert-error mb-4">{error()}</div>
      </Show>
      <div class="flex flex-col gap-4 w-full xl:w-[30rem] shrink-0">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title flex items-center gap-2 text-lg"><Icons.AutoCutSmall />AutoCut</h2>
            <p class="text-sm text-base-content/70">Upload a video, transcribe with WhisperX, AI-remove filler/restarts/pauses, optionally insert AI clips.</p>
            <form class="flex flex-col gap-4 mt-4" onSubmit={onSubmit} enctype="multipart/form-data">
              <label class="flex flex-col gap-1">
                <span class="label-text font-medium">Source Video</span>
                <div class="flex items-center gap-2">
                  <label class="btn btn-primary btn-sm flex-none cursor-pointer">
                    Choose video
                    <input
                      type="file"
                      name="video_file"
                      accept="video/*,.mp4,.mov,.mkv,.webm"
                      required
                      class="hidden"
                      onChange={(e) => setFileName(e.currentTarget.files[0]?.name ?? "No file chosen")}
                    />
                  </label>
                  <span class="text-sm opacity-70 break-all">{fileName()}</span>
                </div>
                <span class="text-xs opacity-60">Supported formats: .mp4, .mov, .mkv, .webm</span>
              </label>

              <label class="label rounded-box border border-base-300 p-3 cursor-pointer flex items-start gap-3">
                <input type="checkbox" checked={generateInsertClips()} onChange={(e) => setGenerateInsertClips(e.currentTarget.checked)} class="checkbox checkbox-primary mt-1" />
                <span class="flex flex-col">
                  <span class="font-semibold">Generate AI Inserts</span>
                  <span class="text-xs opacity-60">Enable to customize AI models and rendering for inserts</span>
                </span>
              </label>

              <Show when={generateInsertClips()}>
                <div class="space-y-4 border border-base-300 rounded-box p-4 bg-base-100">
                  <h3 class="font-semibold flex items-center gap-2"><Icons.SparkleIcon />AI Models</h3>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-medium flex items-center gap-2"><Icons.PhotoCameraSmall />Image Generation Model</span></label>
                    <select name="image_model" class="select select-bordered w-full">
                      <option value="z-image-turbo">Z-Image-Turbo</option>
                    </select>
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-medium flex items-center gap-2"><Icons.VideoCameraSmall />Video Generation Model</span></label>
                    <select name="video_model" class="select select-bordered w-full">
                      <option value="wan2.2">Wan 2.2</option>
                      <option value="ltx2.3">LTX 2.3</option>
                    </select>
                  </div>
                  <h3 class="font-semibold flex items-center gap-2 mt-4"><Icons.CogSettingsIcon />Video Settings</h3>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-medium">FPS</span><output class="label-text-alt text-primary font-bold text-lg">{fps()}</output></label>
                    <input type="range" name="fps" value={String(fps())} min="1" max="24" step="1" class="range range-primary w-full" onInput={(e) => setFps(parseInt(e.currentTarget.value))} />
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-medium">Clip Duration</span><output class="label-text-alt text-secondary font-bold text-lg">{clipDuration()}s</output></label>
                    <input type="range" name="clip_duration" value={String(clipDuration())} min="1" max="10" step="1" class="range range-secondary w-full" onInput={(e) => setClipDuration(parseInt(e.currentTarget.value))} />
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-medium">Transition Duration</span><output class="label-text-alt text-accent font-bold text-lg">{transitionDuration()}s</output></label>
                    <input type="range" name="transition_duration" value={String(transitionDuration())} min="1" max="10" step="1" class="range range-accent w-full" onInput={(e) => setTransitionDuration(parseInt(e.currentTarget.value))} />
                  </div>
                  <div class="form-control mt-2">
                    <label class="label"><span class="label-text font-medium flex items-center gap-2"><Icons.SquaresGridIcon />Resolution</span></label>
                    <select name="resolution" class="select select-bordered w-full">
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="9_16_SD">9:16 (SD)</option>
                      <option value="9_16_HD">9:16 (HD)</option>
                    </select>
                  </div>
                  <div class="form-control mt-2">
                    <label class="label"><span class="label-text font-medium flex items-center gap-2"><Icons.PaintBrushIcon />Style Preset</span></label>
                    <select name="style_preset" class="select select-bordered w-full">
                      <option value="system">Default</option>
                      <option value="watercolor">Watercolor</option>
                      <option value="pencil_watercolor">Pencil Watercolor</option>
                    </select>
                  </div>
                </div>
              </Show>

              <div class="alert alert-soft alert-info text-sm">
                <Icons.InfoIcon /><span>AutoCut uses WhisperX to transcribe, then removes fillers and dead air. Insert clips are optional.</span>
              </div>

              <div class="flex gap-2 justify-between">
                <button type="reset" class="btn btn-ghost" onClick={() => { setFileName("No file chosen"); setGenerateInsertClips(false); }}>Reset</button>
                <button type="submit" class="btn btn-primary" disabled={isSubmitting()}>
                  <Show when={!isSubmitting()} fallback={<span class="loading loading-spinner loading-sm" />}>
                    {generateInsertClips() ? "Start AutoCut" : "Upload & Cut"}
                  </Show>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-[calc(100vh-7rem)]">
        <Show when={!showProgress()} fallback={
          <div class="card bg-base-100 shadow-xl w-full">
            <div class="card-body gap-5">
              <div class="flex justify-between items-start">
                <h2 class="card-title">AutoCut Status</h2>
                <span class="badge badge-warning">Processing</span>
              </div>
              <p class="text-sm opacity-70">Run {jobId()}</p>
              <div class="space-y-2">
                <For each={(eventsData()?.events as unknown as { type: string; status: string; prompt?: string }[]) ?? []} fallback={<div class="text-sm opacity-60">Waiting for events…</div>}>
                  {(ev) => <div class="card bg-base-200 p-2 text-sm flex justify-between"><span class="font-mono">{ev.type}</span><span class="badge badge-sm">{ev.status}</span></div>}
                </For>
              </div>
              <a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm self-end">View Job</a>
            </div>
          </div>
        }>
          <div class="card bg-base-100 shadow-xl w-full min-h-[calc(100vh-7rem)]">
            <div class="card-body items-center justify-center text-center gap-4 py-16">
              <div class="text-primary"><Icons.AutoCutSmall /></div>
              <div class="space-y-2 max-w-xl">
                <h2 class="text-xl font-semibold">Upload a source video</h2>
                <p class="text-base-content/70">AutoCut reviews your video and prepares a cleaner edit with less dead air and fewer rough takes.</p>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
