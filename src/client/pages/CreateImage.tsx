import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet, getAssetPath } from "../lib/api-client";
import { Icons } from "../components/Icons";
import LoraSelector, { LoraSpec } from "../components/LoraSelector";
import StylePresetSelect from "../components/StylePresetSelect";

export default function CreateImage() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

  const [batchSize, setBatchSize] = createSignal(1);
  const [loras, setLoras] = createSignal<LoraSpec[]>([]);
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
    if (loras().length) fd.set("loras", JSON.stringify(loras()));
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
    <div class="flex flex-col sm:px-6 py-5 min-h-[calc(100vh-4rem)] bg-base-200">
      <Show when={error()}>
        <div class="alert alert-error mb-4 text-sm">{error()}</div>
      </Show>
      {/* xl 3-col: prompt | generation options | loras+action+preview - no scroll */}
      <form class="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:items-start" onSubmit={onSubmit} enctype="multipart/form-data">
        {/* col1 prompt + style guide */}
        <div class="xl:col-span-5 flex flex-col gap-4 min-h-0">
          <div class="card bg-base-100 shadow-xl border border-base-300 flex flex-col xl:h-[48vh] min-h-[280px] overflow-hidden">
            <div class="card-body flex flex-col p-4 flex-1 min-h-0">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.PromptIcon />Prompt</h2>
              <textarea name="prompt" class="textarea textarea-ghost w-full flex-1 resize-none min-h-0 focus:outline-none text-sm" placeholder="Describe the image you want to generate..."></textarea>
              <p class="text-xs opacity-50 mt-2">Tip: style preset + loras are applied automatically.</p>
            </div>
          </div>
          <div class="card bg-base-100 shadow-xl border border-base-300 flex-none">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.PaintBrushIcon />Style Guide</h2>
              <textarea name="style_guide" maxLength={2000} rows={4} class="textarea textarea-ghost w-full resize-none focus:outline-none border-0 text-sm min-h-[100px]" placeholder={"Optional: define consistent style...\n• warm ochre palette\n• watercolor texture\n• no modern items"}></textarea>
              <p class="text-xs opacity-50 mt-1">Added to preset. Freeform style instructions.</p>
            </div>
          </div>
          {/* progress inline on mobile */}
          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl border border-base-300 mt-4 xl:hidden">
              <div class="card-body p-4">
                <div class="flex items-center justify-between mb-2"><h2 class="card-title text-base flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2><span class="badge badge-warning badge-sm">Active</span></div>
                <p class="text-xs opacity-60 mb-2 truncate">Monitoring {jobId()}</p>
                <Show when={(eventsData()?.events?.length ?? 0) === 0}><div class="text-sm opacity-60">Waiting for events…</div></Show>
                <Show when={(eventsData()?.events?.length ?? 0) > 0}>
                  <ul class="timeline timeline-compact timeline-vertical text-xs">
                    <For each={(eventsData()?.events as unknown as { id: string; type: string; status: string }[]) ?? []}>
                      {(evt) => <li><div class="timeline-end timeline-box py-1 px-2 text-xs">{evt.type} <span class="badge badge-xs ml-1">{evt.status}</span></div><div class="timeline-middle"><div class="w-4 h-4 rounded-full bg-base-200 grid place-items-center text-[10px]">·</div></div></li>}
                    </For>
                  </ul>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        {/* col2 generation options */}
        <div class="xl:col-span-3 flex flex-col gap-4">
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.SparkleIcon />AI Model</h2>
              <label class="fieldset-label text-xs font-medium opacity-70 flex items-center gap-2"><Icons.PhotoCameraSmall />Image Generation Model</label>
              <select name="image_model" class="select select-bordered select-sm w-full">
                <option value="z-image-turbo">Z-Image-Turbo</option>
              </select>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.CogSettingsIcon />Generation</h2>
              <label class="fieldset-label text-xs font-medium flex justify-between">Batch <span class="badge badge-primary badge-sm">{batchSize()}</span></label>
              <input type="range" name="batch_size" value={String(batchSize())} min="1" max="16" step="1" class="range range-primary range-xs w-full" onInput={(e) => setBatchSize(parseInt(e.currentTarget.value))} />
              <div class="flex justify-between text-[11px] opacity-50"><span>1</span><span>16</span></div>

              <label class="fieldset-label text-xs font-medium opacity-70 mt-3 flex items-center gap-2"><Icons.SquaresGridIcon />Resolution</label>
              <select name="resolution" class="select select-bordered select-sm w-full">
                <option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="9_16_SD">9:16 (SD)</option><option value="9_16_HD">9:16 (HD)</option>
              </select>

              <label class="fieldset-label text-xs font-medium opacity-70 mt-3 flex items-center gap-2"><Icons.PaintBrushIcon />Style Preset</label>
              <StylePresetSelect name="style_preset" class="select select-bordered select-sm w-full" />
            </div>
          </div>
        </div>

        {/* col3 loras + action + preview */}
        <div class="xl:col-span-4 flex flex-col gap-4 min-h-0">
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2">LoRAs <span class="badge badge-ghost badge-xs">0.1 — 2.0</span></h2>
              <LoraSelector value={loras()} onChange={setLoras} />
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.LightningBoltIcon />Action</h2>
              <div class="card-actions justify-between gap-2">
                <button type="reset" class="btn btn-ghost btn-sm">Reset</button>
                <button type="submit" id="submit-btn" class="btn btn-primary btn-sm flex-1" disabled={isSubmitting()}>
                  Generate <Show when={isSubmitting()}><span class="loading loading-spinner loading-xs ml-1" /></Show>
                </button>
              </div>
            </div>
          </div>

          {/* preview area - desktop inline */}
          <Show when={!showProgress()}>
            <div class="card bg-base-100 shadow-xl border border-base-300 hidden xl:flex flex-1 min-h-[220px] items-center justify-center">
              <div class="text-center py-10 px-6">
                <div class="flex justify-center mb-3 opacity-40"><Icons.PhotoCameraLarge /></div>
                <h3 class="font-medium text-base-content/60 text-sm">Images appear here</h3>
                <p class="text-xs opacity-40 mt-1">Submit a prompt to generate</p>
              </div>
            </div>
          </Show>
          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl border border-base-300 hidden xl:flex flex-col overflow-hidden flex-1 min-h-[260px]">
              <div class="card-body p-4 flex flex-col min-h-0">
                <div class="flex items-center justify-between mb-2"><h3 class="font-semibold text-sm flex items-center gap-2"><Icons.PulseWavesIcon />Generated Images</h3><span class="badge badge-warning badge-xs">Active</span></div>
                <Show when={(mediaData()?.items?.length ?? 0) === 0}>
                  <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8">
                    <p class="text-sm text-base-content/60">Generating…</p>
                    <span class="loading loading-dots loading-md text-primary"></span>
                  </div>
                </Show>
                <Show when={(mediaData()?.items?.length ?? 0) > 0}>
                  <div class="grid grid-cols-2 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
                    <For each={mediaData()?.items ?? []}>
                      {(img) => (
                        <div class="rounded-box overflow-hidden bg-base-200 border border-base-300">
                          <img src={getAssetPath(img.subfolder, img.filename)} alt="Generated image" class="w-full h-auto" loading="lazy" />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm mt-3 w-full">View Job</a>
              </div>
            </div>
          </Show>
        </div>

        {/* mobile preview */}
        <Show when={!showProgress()}>
          <div class="card bg-base-100 shadow-xl border border-base-300 xl:hidden flex items-center justify-center min-h-[200px]">
            <div class="text-center py-10"><div class="flex justify-center mb-3 opacity-40"><Icons.PhotoCameraLarge /></div><h3 class="font-medium text-base-content/60 text-sm">Images appear here when generated</h3></div>
          </div>
        </Show>
        <Show when={showProgress() && jobId()}>
          <div class="card bg-base-100 shadow-xl border border-base-300 xl:hidden">
            <div class="card-body p-4">
              <h3 class="font-semibold text-sm mb-2">Generated Images</h3>
              <Show when={(mediaData()?.items?.length ?? 0) === 0}><div class="flex flex-col items-center gap-2 py-8"><span class="loading loading-dots loading-lg text-primary"></span></div></Show>
              <Show when={(mediaData()?.items?.length ?? 0) > 0}>
                <div class="grid grid-cols-2 gap-2">
                  <For each={mediaData()?.items ?? []}>
                    {(img) => <div class="rounded-box overflow-hidden bg-base-200"><img src={getAssetPath(img.subfolder, img.filename)} alt="Generated image" class="w-full h-auto" /></div>}
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
