import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet } from "../lib/api-client";
import { Icons } from "../components/Icons";
import LoraSelector, { LoraSpec } from "../components/LoraSelector";

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
      // parse <option value="x">label</option>
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
    // Don't send empty file that would override script text
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
      // fallback try json
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
    <div class="flex flex-col sm:px-6 py-6 xl:py-5 min-h-[calc(100vh-4rem)] bg-base-200">
      <Show when={error()}>
        <div class="alert alert-error mb-4"><span>{error()}</span></div>
      </Show>
      <form class="flex flex-col xl:flex-row gap-4 xl:flex-1 xl:min-h-0 xl:items-stretch" onSubmit={onSubmit} enctype="multipart/form-data">
        <div class="flex flex-col gap-4 w-full xl:w-1/2 2xl:w-1/3 2xl:min-w-[500px] xl:min-h-0 overflow-hidden xl:self-stretch">
          <div class="card bg-base-100 shadow-xl flex flex-col overflow-hidden flex-1 min-h-0 xl:min-h-0">
            <div class="card-body flex flex-col flex-1 p-4 min-h-0 xl:min-h-0">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.DocumentIcon />Video Script</h2>
              <textarea name="script" id="type-script-tab" class="textarea textarea-ghost w-full flex-1 resize-none min-h-0 focus:outline-none" placeholder="Write your video script here..."></textarea>
              <div class="divider my-2">OR</div>
              <input type="file" name="script_file" accept=".txt,.md" class="file-input file-input-bordered w-full" />
            </div>
          </div>
          <div class="card bg-base-100 shadow-xl flex-none">
            <div class="card-body flex flex-col p-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.PaintBrushIcon />Style Guide</h2>
              <textarea name="style_guide" id="style-guide" maxLength={2000} rows={7} style="height:180px;min-height:180px;max-height:180px" class="textarea textarea-ghost w-full resize-none focus:outline-none border-0 focus:border-0 focus:ring-0" placeholder={"Define consistent style across all images...\n• warm ochre palette\n• watercolor texture\n• ancient Egypt only - no modern items\n• consistent character appearance"}></textarea>
              <p class="text-xs text-base-content/60 mt-2">Defines stylistic coherence across all generated images. Applied in addition to Style Preset.</p>
            </div>
          </div>
        </div>

        <div class="flex flex-col w-full xl:w-[26rem] gap-4 xl:flex-none">
          {/* AI Models */}
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col flex-grow">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.SparkleIcon />AI Models</h2>
              <div class="form-control flex-grow">
                <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.PhotoCameraSmall />Image Generation Model</span></label>
                <select name="image_model" class="select select-bordered w-full">
                  <option value="z-image-turbo">Z-Image-Turbo</option>
                </select>
              </div>
              <div class="form-control flex-grow">
                <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.VideoCameraSmall />Video Generation Model</span></label>
                <select name="video_model" class="select select-bordered w-full">
                  <option value="wan2.2">Wan 2.2</option>
                  <option value="ltx2.3">LTX 2.3</option>
                </select>
              </div>
            </div>
          </div>

          {/* Video Settings */}
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.CogSettingsIcon />Video Settings</h2>
              <div class="form-control flex-grow">
                <label class="label cursor-pointer">
                  <span class="label-text font-medium">Frames Per Second (FPS)</span>
                  <output class="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center">{fps()}</output>
                </label>
                <input type="range" name="fps" value={String(fps())} min="1" max="24" step="1" class="range range-primary w-full" onInput={(e) => setFps(parseInt(e.currentTarget.value))} />
                <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>1 FPS</span><span>24 FPS</span></div>
              </div>
              <div class="form-control flex-grow">
                <label class="label cursor-pointer">
                  <span class="label-text font-medium">Clip Duration</span>
                  <output class="label-text-alt text-secondary font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center">{clipDuration()}s</output>
                </label>
                <input type="range" name="clip_duration" value={String(clipDuration())} min="1" max="10" step="1" class="range range-secondary w-full" onInput={(e) => setClipDuration(parseInt(e.currentTarget.value))} />
                <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>1 sec</span><span>10 secs</span></div>
              </div>
              <div class="form-control flex-grow">
                <label class="label cursor-pointer">
                  <span class="label-text font-medium">Transition Duration</span>
                  <output class="label-text-alt text-accent font-bold text-lg px-2 py-1 min-w-[2.5rem] text-center">{transitionDuration()}s</output>
                </label>
                <input type="range" name="transition_duration" value={String(transitionDuration())} min="1" max="10" step="1" class="range range-accent w-full" onInput={(e) => setTransitionDuration(parseInt(e.currentTarget.value))} />
                <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>1 sec</span><span>10 secs</span></div>
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
            </div>
          </div>

          {/* Style Preset */}
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.PaintBrushLarge />Style Preset</h2>
              <div class="form-control">
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
            <div class="card-body flex flex-col">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3">Loras</h2>
              <LoraSelector value={loras()} onChange={setLoras} />
            </div>
          </div>

          {/* Voice */}
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.MicIcon />Voice</h2>
              <div class="form-control">
                <label class="label cursor-pointer"><span class="label-text font-medium flex items-center gap-2"><Icons.MicIconSmall />TTS Voice</span></label>
                <select name="voice_id" class="select select-bordered w-full flex-none">
                  <Show when={voiceOptions()} fallback={<option value="preset:kokoro:af_bella">Default (Kokoro)</option>}>
                    {(opts) => <For each={opts()}>{(o) => <option value={o.value}>{o.label}</option>}</For>}
                  </Show>
                </select>
              </div>
            </div>
          </div>

          {/* Action */}
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.LightningBoltIcon />Action!</h2>
              <div class="card-actions justify-between flex flex-row gap-2 mt-auto">
                <button type="reset" class="btn btn-ghost">Reset</button>
                <button type="submit" id="submit-btn" class="btn btn-primary" disabled={isSubmitting()}>
                  Generate Video
                  <Show when={isSubmitting()}><span class="loading loading-spinner loading-sm ml-2" /></Show>
                </button>
              </div>
            </div>
          </div>
        </div>

        <Show when={showProgress() && jobId()}>
          <div class="w-full xl:w-[26rem] xl:flex-none min-w-0 min-h-0 flex flex-col">
            <div class="card bg-base-100 shadow-xl w-full max-h-[calc(100vh-7rem)] overflow-y-auto flex flex-col">
              <div class="card-body flex flex-col">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <h2 class="card-title text-lg font-semibold flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2>
                  <span class="badge badge-warning">Active</span>
                </div>
                <p class="text-sm opacity-70 mb-4">Monitoring job: {jobId()}</p>
                <Show when={(eventsData()?.events?.length ?? 0) === 0}>
                  <div class="text-sm opacity-60">Waiting for events…</div>
                </Show>
                <Show when={(eventsData()?.events?.length ?? 0) > 0}>
                  <ul class="timeline timeline-compact timeline-vertical">
                    <For each={(eventsData()?.events as unknown as { id: string; type: string; status: string; prompt?: string | null; created_at: string }[]) ?? []}>
                      {(evt, idx) => {
                        const isComplete = () => evt.status === "complete";
                        const label = () => ({ new_text_prompt: "Text Prompt", new_image_prompt: "Image Prompt", new_video_prompt: "Video Prompt", new_video_composition: "Final Composition", new_transition_prompt: "Transition Prompt", new_audio_prompt: "Audio Prompt", NewTextPrompt: "Text Prompt", NewImagePrompt: "Image Prompt", NewVideoPrompt: "Video Prompt", NewVideoComposition: "Final Composition", NewTransitionPrompt: "Transition Prompt", NewAudioPrompt: "Audio Prompt" }[evt.type] ?? evt.type);
                        const icon = () => ({ new_text_prompt: "🖊️", new_image_prompt: "🖼️", new_video_prompt: "🎬", new_video_composition: "🏁", new_transition_prompt: "🔄", new_audio_prompt: "🎵", NewTextPrompt: "🖊️", NewImagePrompt: "🖼️", NewVideoPrompt: "🎬", NewVideoComposition: "🏁", NewTransitionPrompt: "🔄", NewAudioPrompt: "🎵" }[evt.type] ?? "📌");
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
          </div>
        </Show>
      </form>
      <dialog id="job-action-modal" class="modal"></dialog>
    </div>
  );
}
