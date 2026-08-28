import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet, getAssetPath } from "../lib/api-client";
import { Icons } from "../components/Icons";

export default function CreateImage() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

  const [batchSize, setBatchSize] = createSignal(1);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [eventsData, { refetch }] = createResource(
    () => (showProgress() ? jobId() : undefined),
    async (id) => {
      if (!id) return { events: [] as unknown[] };
      try {
        const data = await apiGet<{ events: unknown[] }>(`/api/jobs/${id}/events?limit=30`);
        return data;
      } catch {
        return { events: [] };
      }
    },
  );

  const [mediaData, { refetch: refetchMedia }] = createResource(
    () => (showProgress() ? jobId() : undefined),
    async (id) => {
      if (!id) return { items: [] as { filename: string; subfolder: string }[] };
      try {
        const data = await apiGet<{ items: { filename: string; subfolder: string; mediaType: string | null }[] }>(`/api/jobs/${id}/media?limit=100`);
        return data;
      } catch {
        return { items: [] };
      }
    },
  );

  useJobUpdates(jobId, () => { refetch(); refetchMedia(); });

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    try {
      const res = await fetch("/api/jobs/images", { method: "POST", body: fd });
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
          navigate(`/create/image?show_progress=true&job_id=${jid}`);
        }
      } else {
        // fallback
        const txt = await res.clone().text();
        try {
          const j = JSON.parse(txt);
          if (j.jobId) navigate(`/create/image?show_progress=true&job_id=${j.jobId}`);
        } catch {}
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">
      <Show when={error()}>
        <div class="alert alert-error mb-4 text-sm">{error()}</div>
      </Show>
      <form class="flex flex-col xl:flex-row gap-4 xl:h-full" onSubmit={onSubmit} enctype="multipart/form-data">
        <div class="flex flex-col w-full xl:w-[50%] gap-4">
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col overflow-hidden">
            <div class="card-body flex flex-col p-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.PromptIcon />Prompt</h2>
              <textarea name="prompt" class="textarea textarea-ghost w-full flex-grow resize-none mb-4 min-h-[250px] focus:outline-none" placeholder="Describe the image you want to generate..."></textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
              <div class="card-body flex flex-col p-4">
                <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.SparkleIcon />AI Model</h2>
                <div class="form-control">
                  <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.PhotoCameraSmall />Image Generation Model</span></label>
                  <select name="image_model" class="select select-bordered w-full flex-none">
                    <option value="z-image-turbo">Z-Image-Turbo</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
              <div class="card-body flex flex-col p-4">
                <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.CogSettingsIcon />Generation Options</h2>
                <div class="form-control">
                  <label class="label cursor-pointer">
                    <span class="label-text font-medium">Batch Size</span>
                    <output class="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center">{batchSize()}</output>
                  </label>
                  <input type="range" name="batch_size" value={String(batchSize())} min="1" max="16" step="1" class="range range-primary w-full" onInput={(e) => setBatchSize(parseInt(e.currentTarget.value))} />
                  <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>1 image</span><span>16 images</span></div>
                </div>
                <div class="form-control mt-2">
                  <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.SquaresGridIcon />Resolution</span></label>
                  <select name="resolution" class="select select-bordered w-full flex-none">
                    <option value="480p">480p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="9_16_SD">9:16 (SD)</option>
                    <option value="9_16_HD">9:16 (HD)</option>
                  </select>
                </div>
                <div class="form-control mt-2 flex-none">
                  <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.PaintBrushIcon />Style Preset</span></label>
                  <select name="style_preset" class="select select-bordered w-full flex-none">
                    <option value="system">Default</option>
                    <option value="watercolor">Watercolor</option>
                    <option value="pencil_watercolor">Pencil Watercolor</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
              <div class="card-body flex flex-col p-4 h-full">
                <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.LightningBoltIcon />Action</h2>
                <div class="card-actions justify-between gap-2 mt-auto">
                  <button type="reset" class="btn btn-ghost">Reset</button>
                  <button type="submit" id="submit-btn" class="btn btn-primary" disabled={isSubmitting()}>
                    Generate
                    <Show when={isSubmitting()}><span class="loading loading-spinner loading-sm ml-2" /></Show>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl w-full max-h-[calc(40vh-3rem)] overflow-y-auto flex-none flex flex-col">
              <div class="card-body flex flex-col p-4">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <h2 class="card-title text-lg font-semibold flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2>
                  <span class="badge badge-warning">Active</span>
                </div>
                <p class="text-sm opacity-70 mb-2">Monitoring job: {jobId()}</p>
                <Show when={(eventsData()?.events?.length ?? 0) === 0}>
                  <div class="text-sm opacity-60">Waiting for events…</div>
                </Show>
                <Show when={(eventsData()?.events?.length ?? 0) > 0}>
                  <ul class="timeline timeline-compact timeline-vertical">
                    <For each={(eventsData()?.events as unknown as { id: string; type: string; status: string; prompt?: string | null; created_at: string }[]) ?? []}>
                      {(evt, idx) => {
                        const isComplete = () => evt.status === "complete";
                        const label = () => ({ NewImagePrompt: "Image Prompt", NewVideoPrompt: "Video Prompt", NewTextPrompt: "Text Prompt", NewAudioPrompt: "Audio Prompt", NewTransitionPrompt: "Transition Prompt", NewVideoComposition: "Final Composition" }[evt.type] ?? evt.type);
                        const icon = () => ({ NewImagePrompt: "🖼️", NewVideoPrompt: "🎬", NewTextPrompt: "🖊️", NewAudioPrompt: "🎵", NewTransitionPrompt: "🔄", NewVideoComposition: "🏁" }[evt.type] ?? "📌");
                        return (
                          <li style="content-visibility:auto; contain-intrinsic-size: 200px 300px;">
                            {idx() !== 0 && <hr class={isComplete() ? "bg-success" : ""} />}
                            <div class="timeline-end timeline-box w-[98%] border border-base-300 bg-base-100 min-w-64 max-w-full">
                              <details class="w-full bg-base-100 open:bg-base-100">
                                <summary class="cursor-pointer list-none p-3 hover:bg-base-200 rounded-lg transition-colors">
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="text-sm font-bold text-base-content/60">{label()}</span>
                                    <span class={isComplete() ? "badge badge-success text-xs" : "badge badge-warning text-xs"}>{isComplete() ? <Icons.StatusCompleteSmall /> : <Icons.StatusPendingSmall />}</span>
                                  </div>
                                </summary>
                                <div class="p-3 pt-0 mt-2 space-y-2">
                                  <Show when={evt.prompt}><div class="text-sm whitespace-pre-wrap break-words bg-base-200 p-2 rounded">{evt.prompt}</div></Show>
                                  <div class="text-xs opacity-50">{new Date(evt.created_at).toLocaleString()}</div>
                                </div>
                              </details>
                            </div>
                            <div class="timeline-middle"><div class={`w-6 h-6 rounded-full flex items-center justify-center text-sm shadow-sm ${isComplete() ? "bg-success text-success-content" : "bg-base-200"}`}>{icon()}</div></div>
                            {idx() !== (eventsData()?.events?.length ?? 0) - 1 && <hr class={isComplete() ? "bg-success" : ""} />}
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
                <div class="card-actions justify-end mt-4 gap-2">
                  <a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm">View Job</a>
                </div>
              </div>
            </div>
          </Show>
        </div>

        <Show when={!showProgress()}>
          <div class="card bg-base-100 shadow-xl w-full xl:flex-1 flex-grow min-h-[calc(100vh-7rem)] flex items-center justify-center">
            <div class="text-center py-16">
              <div class="flex justify-center mb-4 opacity-60"><Icons.PhotoCameraLarge /></div>
              <h3 class="font-medium text-base-content/60">The image(s) will show up here when they are generated.</h3>
            </div>
          </div>
        </Show>
        <Show when={showProgress() && jobId()}>
          <div class="card bg-base-100 shadow-xl w-full xl:flex-1 flex-grow min-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
            <div class="card-body flex flex-col">
              <h3 class="font-semibold mb-2">Generated Images</h3>
              <Show when={(mediaData()?.items?.length ?? 0) === 0}>
                <div class="flex flex-col items-center justify-center gap-2 py-16">
                  <p class="text-lg font-large text-base-content/60">Generating images</p>
                  <span class="loading loading-dots loading-lg text-primary"></span>
                </div>
              </Show>
              <Show when={(mediaData()?.items?.length ?? 0) > 0}>
                <div class="columns-1 sm:columns-1 lg:columns-2 xl:columns-2 gap-3 space-y-3 max-w-full">
                  <For each={mediaData()?.items ?? []}>
                    {(img) => (
                      <div class="card bg-base-200 break-inside-avoid rounded-box mb-3">
                        <figure class="bg-base-300 overflow-hidden rounded-box">
                          <img src={getAssetPath(img.subfolder, img.filename)} alt="Generated image" class="w-full h-auto" loading="lazy" />
                        </figure>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </form>
      <dialog id="job-action-modal" class="modal"></dialog>
    </div>
  );
}
