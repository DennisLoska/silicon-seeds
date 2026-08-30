import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet } from "../lib/api-client";
import { Icons } from "../components/Icons";
import LoraSelector, { LoraSpec } from "../components/LoraSelector";
import StylePresetSelect from "../components/StylePresetSelect";

export default function Compose() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

  const [fps, setFps] = createSignal(16);
  const [clipDuration, setClipDuration] = createSignal(5);
  const [transitionDuration, setTransitionDuration] = createSignal(3);
  const [loras, setLoras] = createSignal<LoraSpec[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [voiceOptions] = createResource(async () => {
    try {
      const r = await fetch("/api/tts/profiles-options");
      if (!r.ok) return null;
      const html = await r.text();
      const opts: { value: string; label: string }[] = [];
      const re = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) opts.push({ value: m[1], label: m[2] });
      if (opts.length === 0) return [{ value: "preset:kokoro:af_bella", label: "Default (Kokoro)" }];
      return opts;
    } catch {
      return [{ value: "preset:kokoro:af_bella", label: "Default (Kokoro)" }];
    }
  });

  const [eventsData, { refetch: refetchEvents }] = createResource(
    () => (showProgress() ? jobId() : undefined),
    async (id) => {
      if (!id) return { events: [] as unknown[], total: 0 };
      try {
        const data = await apiGet<{ events: unknown[]; total: number }>(`/api/jobs/${id}/events?limit=50`);
        return data;
      } catch {
        return { events: [], total: 0 };
      }
    },
  );

  useJobUpdates(jobId, () => refetchEvents());

  const onSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    if (loras().length) fd.set("loras", JSON.stringify(loras()));
    const f = fd.get("script_file") as File | null;
    if (f && f.size === 0 && f.name === "") fd.delete("script_file");
    try {
      const res = await fetch("/api/jobs/videos/compose", { method: "POST", body: fd });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt.slice(0, 500));
        setIsSubmitting(false);
        return;
      }
      const redirect = res.headers.get("HX-Redirect") || res.headers.get("hx-redirect");
      if (redirect) {
        const url = new URL(redirect, window.location.origin);
        const jid = url.searchParams.get("job_id");
        if (jid) {
          setSearch({ show_progress: "true", job_id: jid });
          navigate(`/compose?show_progress=true&job_id=${jid}`);
          setIsSubmitting(false);
          return;
        }
      }
      try {
        const j = await res.clone().json();
        if (j.jobId) {
          navigate(`/compose?show_progress=true&job_id=${j.jobId}`);
          setSearch({ show_progress: "true", job_id: j.jobId });
        }
      } catch {}
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col sm:px-6 py-5 min-h-[calc(100vh-4rem)] bg-base-200">
      <Show when={error()}>
        <div class="alert alert-error mb-4"><span>{error()}</span></div>
      </Show>
      <form class="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:items-start" onSubmit={onSubmit} enctype="multipart/form-data">
        {/* col1 - script + style guide - unified with image view, prompt full height, styleguide higher */}
        <div class="flex flex-col gap-4 xl:col-span-5 min-h-0">
          <div class="card bg-base-100 shadow-xl border border-base-300 flex flex-col overflow-hidden xl:h-[52vh] min-h-[340px]">
            <div class="card-body flex flex-col flex-1 p-4 min-h-0">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.DocumentIcon />Video Script</h2>
              <textarea name="script" id="type-script-tab" class="textarea textarea-ghost w-full flex-1 resize-none min-h-0 focus:outline-none text-sm leading-relaxed" placeholder="Write your video script here..."></textarea>
              <div class="divider my-2">OR</div>
              <input type="file" name="script_file" accept=".txt,.md" class="file-input file-input-bordered file-input-sm w-full" />
            </div>
          </div>
          <div class="card bg-base-100 shadow-xl border border-base-300 flex flex-col overflow-hidden xl:h-[28vh] min-h-[220px]">
            <div class="card-body flex flex-col flex-1 p-4 min-h-0">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.PaintBrushIcon />Style Guide</h2>
              <textarea name="style_guide" id="style-guide" maxLength={2000} class="textarea textarea-ghost w-full flex-1 resize-none min-h-0 focus:outline-none text-sm leading-relaxed" placeholder={"Define consistent style across all images...\n• warm ochre palette\n• watercolor texture\n• ancient Egypt only - no modern items\n• consistent character appearance"}></textarea>
            </div>
          </div>
          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl border border-base-300 xl:hidden">
              <div class="card-body p-4">
                <div class="flex items-center justify-between gap-2 mb-2"><h2 class="card-title text-base flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2><span class="badge badge-warning badge-sm">Active</span></div>
                <p class="text-xs opacity-70 mb-3">Monitoring job: {jobId()}</p>
                <Show when={(eventsData()?.events?.length ?? 0) === 0}><div class="text-sm opacity-60">Waiting for events…</div></Show>
                <Show when={(eventsData()?.events?.length ?? 0) > 0}>
                  <ul class="timeline timeline-compact timeline-vertical">
                    <For each={(eventsData()?.events as unknown as { id: string; type: string; status: string }[]) ?? []}>
                      {(evt, idx) => {
                        const isComplete = () => evt.status === "complete";
                        return (
                          <li>
                            {idx() !== 0 && <hr class={isComplete() ? "bg-success" : ""} />}
                            <div class="timeline-end timeline-box w-[98%] border border-base-300 bg-base-100 text-xs">{evt.type} <span class={isComplete() ? "badge badge-success badge-xs ml-1" : "badge badge-warning badge-xs ml-1"}>{evt.status}</span></div>
                            <div class="timeline-middle"><div class={`w-5 h-5 rounded-full grid place-items-center text-xs ${isComplete() ? "bg-success text-success-content" : "bg-base-200"}`}>✓</div></div>
                            {idx() !== (eventsData()?.events?.length ?? 0) - 1 && <hr class={isComplete() ? "bg-success" : ""} />}
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
                <a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm mt-3 w-full">View Job</a>
              </div>
            </div>
          </Show>
        </div>

        {/* col2 middle - AI Models + Video Settings + Style Preset + Loras + Action (moved from col3) */}
        <div class="flex flex-col gap-4 xl:col-span-3">
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.SparkleIcon />AI Models</h2>
              <label class="fieldset-label text-xs font-medium opacity-70 flex items-center gap-2"><Icons.PhotoCameraSmall />Image Generation Model</label>
              <select name="image_model" class="select select-bordered select-sm w-full">
                <option value="z-image-turbo">Z-Image-Turbo</option>
              </select>
              <label class="fieldset-label text-xs font-medium opacity-70 flex items-center gap-2 mt-3"><Icons.VideoCameraSmall />Video Generation Model</label>
              <select name="video_model" class="select select-bordered select-sm w-full">
                <option value="wan2.2">Wan 2.2</option>
                <option value="ltx2.3">LTX 2.3</option>
              </select>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.CogSettingsIcon />Video Settings</h2>
              <label class="fieldset-label text-xs font-medium flex items-center justify-between">FPS <span class="badge badge-primary badge-sm">{fps()}</span></label>
              <input type="range" name="fps" value={String(fps())} min="1" max="24" step="1" class="range range-primary range-xs w-full" onInput={(e) => setFps(parseInt(e.currentTarget.value))} />
              <div class="flex justify-between text-[11px] opacity-50"><span>1</span><span>24</span></div>
              <label class="fieldset-label text-xs font-medium flex items-center justify-between mt-3">Clip <span class="badge badge-secondary badge-sm">{clipDuration()}s</span></label>
              <input type="range" name="clip_duration" value={String(clipDuration())} min="1" max="10" step="1" class="range range-secondary range-xs w-full" onInput={(e) => setClipDuration(parseInt(e.currentTarget.value))} />
              <label class="fieldset-label text-xs font-medium flex items-center justify-between mt-3">Transition <span class="badge badge-accent badge-sm">{transitionDuration()}s</span></label>
              <input type="range" name="transition_duration" value={String(transitionDuration())} min="1" max="10" step="1" class="range range-accent range-xs w-full" onInput={(e) => setTransitionDuration(parseInt(e.currentTarget.value))} />
              <label class="fieldset-label text-xs font-medium opacity-70 mt-3 flex items-center gap-2"><Icons.SquaresGridIcon />Resolution</label>
              <select name="resolution" class="select select-bordered select-sm w-full">
                <option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="9_16_SD">9:16 (SD)</option><option value="9_16_HD">9:16 (HD)</option>
              </select>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.PaintBrushLarge />Style Preset</h2>
              <StylePresetSelect name="style_preset" class="select select-bordered select-sm w-full" />
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2">LoRAs <span class="badge badge-ghost badge-xs">drag · 0.1-2.0</span></h2>
              <LoraSelector value={loras()} onChange={setLoras} />
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.LightningBoltIcon />Action</h2>
              <div class="card-actions justify-between flex gap-2">
                <button type="reset" class="btn btn-ghost btn-sm">Reset</button>
                <button type="submit" id="submit-btn" class="btn btn-primary btn-sm flex-1" disabled={isSubmitting()}>
                  Generate Video <Show when={isSubmitting()}><span class="loading loading-spinner loading-xs ml-1" /></Show>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* col3 - Voice + double height preview + progress */}
        <div class="flex flex-col gap-4 xl:col-span-4">
          <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body p-4">
              <h2 class="card-title text-base font-semibold flex items-center gap-2 mb-2"><Icons.MicIcon />Voice</h2>
              <select name="voice_id" class="select select-bordered select-sm w-full">
                <Show when={voiceOptions()} fallback={<option value="preset:kokoro:af_bella">Default (Kokoro)</option>}>
                  {(opts) => <For each={opts()}>{(o) => <option value={o.value}>{o.label}</option>}</For>}
                </Show>
              </select>
            </div>
          </div>

          {/* double height preview - was min-h 220, now 440 + h 60vh */}
          <div class="card bg-base-100 shadow-xl border border-base-300 hidden xl:flex flex-col overflow-hidden xl:h-[60vh] min-h-[440px]">
            <div class="card-body p-4 flex flex-col flex-1 min-h-0">
              <h3 class="font-semibold text-sm flex items-center gap-2 mb-2"><Icons.Video /> Preview</h3>
              <div class="flex-1 flex flex-col items-center justify-center gap-3 py-6 bg-base-200 rounded-box border border-dashed border-base-300 min-h-0">
                <div class="w-16 h-16 rounded-box bg-base-300 grid place-items-center opacity-40"><Icons.VideoCameraSmall /></div>
                <p class="text-sm font-medium opacity-60">Video preview</p>
                <p class="text-xs opacity-40">Submit to generate — preview doubled height</p>
              </div>
              <p class="text-[11px] opacity-40 mt-2 text-center">Tip: use 480p / 8 FPS for fastest test</p>
            </div>
          </div>

          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl border border-base-300 hidden xl:flex flex-col max-h-[38vh] overflow-hidden">
              <div class="card-body p-4 flex flex-col min-h-0">
                <div class="flex items-center justify-between gap-2 mb-2"><h2 class="card-title text-base flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2><span class="badge badge-warning badge-sm">Active</span></div>
                <p class="text-xs opacity-60 mb-3 truncate">Monitoring {jobId()}</p>
                <div class="flex-1 overflow-y-auto min-h-0">
                  <Show when={(eventsData()?.events?.length ?? 0) === 0}><div class="text-sm opacity-60">Waiting for events…</div></Show>
                  <Show when={(eventsData()?.events?.length ?? 0) > 0}>
                    <ul class="timeline timeline-compact timeline-vertical">
                      <For each={(eventsData()?.events as unknown as { id: string; type: string; status: string }[]) ?? []}>
                        {(evt, idx) => {
                          const isComplete = () => evt.status === "complete";
                          return (
                            <li>
                              {idx() !== 0 && <hr class={isComplete() ? "bg-success" : ""} />}
                              <div class="timeline-end timeline-box text-xs py-1 px-2 border border-base-300">{evt.type} <span class={isComplete() ? "badge badge-success badge-xs" : "badge badge-warning badge-xs"}>{evt.status}</span></div>
                              <div class="timeline-middle"><div class={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${isComplete() ? "bg-success text-success-content" : "bg-base-200"}`}>{isComplete() ? "✓" : "·"}</div></div>
                              {idx() !== (eventsData()?.events?.length ?? 0) - 1 && <hr class={isComplete() ? "bg-success" : ""} />}
                            </li>
                          );
                        }}
                      </For>
                    </ul>
                  </Show>
                </div>
                <a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm mt-3 w-full">View Job</a>
              </div>
            </div>
          </Show>
        </div>
      </form>
      <dialog id="job-action-modal" class="modal"></dialog>
    </div>
  );
}
