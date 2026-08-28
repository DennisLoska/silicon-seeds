import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet } from "../lib/api-client";
import { Icons } from "../components/Icons";

export default function AutoCut() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

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
              <p class="text-sm text-base-content/70">Upload a video, transcribe with WhisperX and auto-remove filler, restarts and dead air.</p>
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
                      onChange={(e) => setFileName((e.currentTarget as HTMLInputElement).files?.[0]?.name ?? "No file chosen")}
                    />
                  </label>
                  <span class="text-sm opacity-70 break-all">{fileName()}</span>
                </div>
                <span class="text-xs opacity-60">Supported formats: .mp4, .mov, .mkv, .webm</span>
              </label>

              <div class="alert alert-soft alert-info text-sm">
                <Icons.InfoIcon /><span>AutoCut uses WhisperX to transcribe, then removes fillers and dead air for a cleaner cut.</span>
              </div>

              <div class="flex gap-2 justify-between">
                <button type="reset" class="btn btn-ghost" onClick={() => setFileName("No file chosen")}>Reset</button>
                <button type="submit" class="btn btn-primary" disabled={isSubmitting()}>
                  <Show when={!isSubmitting()} fallback={<span class="loading loading-spinner loading-sm" />}>Upload & Cut</Show>
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
