import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet } from "../lib/api-client";
import { Icons } from "../components/Icons";

export default function CreateAudio() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const showProgress = () => search.show_progress === "true" && !!search.job_id;
  const jobId = () => search.job_id as string | undefined;

  const [duration, setDuration] = createSignal(60);
  const [bpm, setBpm] = createSignal(72);
  const [cfg, setCfg] = createSignal(2);
  const [temperature, setTemperature] = createSignal(0.85);
  const [topP, setTopP] = createSignal(0.9);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [eventsData, { refetch }] = createResource(
    () => (showProgress() ? jobId() : undefined),
    async (id) => {
      if (!id) return { events: [] as unknown[] };
      try {
        const d = await apiGet<{ events: unknown[] }>(`/api/jobs/${id}/events?limit=20`);
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
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    // if lyric_prompt empty, schema requires min1 — send placeholder single space? But baseline allows empty for instrumental; we coerce empty to "instrumental"
    const lyric = (fd.get("lyric_prompt") as string | null)?.trim();
    if (!lyric) fd.set("lyric_prompt", "instrumental");
    try {
      const res = await fetch("/api/jobs/audio", { method: "POST", body: fd });
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
          navigate(`/create/audio?show_progress=true&job_id=${jid}`);
        }
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
        <div class="card bg-base-100 shadow-xl w-full xl:w-1/2 2xl:w-1/3 flex flex-col overflow-hidden min-h-0 xl:h-full">
          <div class="card-body flex flex-col p-4 gap-4 flex-grow min-h-0 h-full">
            <div>
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-1"><Icons.PromptIcon />Prompts</h2>
              <p class="text-sm text-base-content/70">Shape the arrangement and lyric intent separately for the ACE Step 1.5 song workflow.</p>
            </div>
            <fieldset class="fieldset">
              <legend class="fieldset-legend">Instrumental Prompt</legend>
              <textarea name="instrumental_prompt" class="textarea textarea-ghost w-full resize-none min-h-[180px] focus:outline-none" placeholder="slow burn ambient pop, intimate piano, glassy synths, soft sub bass, restrained percussion, dusk atmosphere"></textarea>
              <p class="label text-xs opacity-60">Describe arrangement, instrumentation, groove, texture, and mood.</p>
            </fieldset>
            <div class="flex flex-col flex-grow min-h-0 h-full gap-2">
              <label for="lyric_prompt" class="fieldset-legend">Lyric Prompt</label>
              <textarea id="lyric_prompt" name="lyric_prompt" class="textarea textarea-ghost w-full flex-grow h-full resize-none min-h-[220px] focus:outline-none" placeholder="Optional. A short hook, imagery, or lyrical concept. Leave blank for purely instrumental output."></textarea>
              <p class="label text-xs opacity-60">Short ideas work better than fully written verses.</p>
            </div>
          </div>
        </div>

        <div class="flex flex-col w-full xl:w-[26rem] gap-4 xl:flex-none">
          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body p-4 flex flex-col gap-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.CogSettingsIcon />Timing</h2>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">Duration</span><output class="label-text-alt text-primary font-bold text-lg px-2 py-1 min-w-[3rem] text-center">{duration()}s</output></label>
                <input type="range" name="duration" value={String(duration())} min="10" max="720" step="1" class="range range-primary" onInput={(e) => setDuration(parseInt(e.currentTarget.value))} />
                <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>10s</span><span>720s</span></div>
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">BPM</span><output class="label-text-alt text-secondary font-bold text-lg px-2 py-1 min-w-[3rem] text-center">{bpm()}</output></label>
                <input type="range" name="bpm" value={String(bpm())} min="40" max="240" step="1" class="range range-secondary" onInput={(e) => setBpm(parseInt(e.currentTarget.value))} />
                <div class="flex justify-between text-xs text-base-content/50 mt-1"><span>40</span><span>240</span></div>
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body p-4 flex flex-col gap-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.SparkleIcon />Generation Controls</h2>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">CFG Scale</span><output class="label-text-alt text-accent font-bold text-lg px-2 py-1 min-w-[3rem] text-center">{cfg()}</output></label>
                <input type="range" name="cfg_scale" value={String(cfg())} min="0" max="10" step="0.5" class="range range-accent" onInput={(e) => setCfg(parseFloat(e.currentTarget.value))} />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">Temperature</span><output class="label-text-alt text-info font-bold text-lg px-2 py-1 min-w-[3rem] text-center">{Number(temperature()).toFixed(2)}</output></label>
                <input type="range" name="temperature" value={String(temperature())} min="0" max="2" step="0.05" class="range range-info" onInput={(e) => setTemperature(parseFloat(e.currentTarget.value))} />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">Top P</span><output class="label-text-alt text-success font-bold text-lg px-2 py-1 min-w-[3rem] text-center">{Number(topP()).toFixed(2)}</output></label>
                <input type="range" name="top_p" value={String(topP())} min="0" max="1" step="0.01" class="range range-success" onInput={(e) => setTopP(parseFloat(e.currentTarget.value))} />
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body p-4">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.Audio />Musical Framing</h2>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Key / Scale</legend>
                <select name="keyscale" class="select select-bordered w-full">
                  <option value="C major">C major</option>
                  <option value="A minor">A minor</option>
                  <option value="D minor">D minor</option>
                  <option value="E minor" selected>E minor</option>
                  <option value="G major">G major</option>
                  <option value="B minor">B minor</option>
                  <option value="F# minor">F# minor</option>
                </select>
              </fieldset>
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Time Signature</legend>
                <div class="join w-full">
                  <input class="btn join-item flex-1" type="radio" name="timesignature" aria-label="2/4" value="2" />
                  <input class="btn join-item flex-1" type="radio" name="timesignature" aria-label="3/4" value="3" />
                  <input class="btn join-item flex-1" type="radio" name="timesignature" aria-label="4/4" value="4" checked />
                  <input class="btn join-item flex-1" type="radio" name="timesignature" aria-label="6/8" value="6" />
                </div>
              </fieldset>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
            <div class="card-body flex flex-col p-4 h-full">
              <h2 class="card-title text-lg font-semibold flex items-center gap-2 mb-3"><Icons.LightningBoltIcon />Generate Audio</h2>
              <div role="alert" class="alert alert-soft alert-info mb-4 text-sm"><Icons.InfoIcon /><span>CFG strengthens prompt adherence, Temperature adds variation, and Top P narrows or broadens the token choices.</span></div>
              <div class="card-actions justify-between gap-2 mt-auto">
                <button type="reset" class="btn btn-ghost">Reset</button>
                <button type="submit" id="submit-btn" class="btn btn-primary" disabled={isSubmitting()}><span>Generate</span><Show when={isSubmitting()}><span class="loading loading-spinner loading-sm ml-2" /></Show></button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col w-full xl:flex-1 gap-4 min-h-[calc(100vh-7rem)]">
          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl w-full max-h-[calc(40vh-3rem)] overflow-y-auto flex-none flex flex-col">
              <div class="card-body flex flex-col p-4">
                <div class="flex items-start justify-between gap-4 mb-3">
                  <h2 class="card-title text-lg font-semibold flex items-center gap-2"><Icons.PulseWavesIcon />Job Progress</h2>
                  <span class="badge badge-warning">Active</span>
                </div>
                <p class="text-sm opacity-70 mb-2">Monitoring job: {jobId()}</p>
                <div class="space-y-2">
                  <For each={(eventsData()?.events as unknown as { type: string; status: string }[]) ?? []} fallback={<div class="text-sm opacity-60">Waiting for events…</div>}>
                    {(ev) => <div class="card bg-base-200 p-2 text-sm flex justify-between"><span>{ev.type}</span><span class="badge badge-sm">{ev.status}</span></div>}
                  </For>
                </div>
                <div class="card-actions justify-end mt-4 gap-2"><a href={`/jobs?job_id=${jobId()}&filter=all&tab=status`} class="btn btn-primary btn-sm">View Job</a></div>
              </div>
            </div>
          </Show>
          <Show when={!showProgress()}>
            <div class="card bg-base-100 shadow-xl w-full flex-1 flex items-center justify-center">
              <div class="flex items-center gap-3 py-16 px-6 text-center">
                <div class="shrink-0 text-base-content/60"><Icons.Audio /></div>
                <h3 class="font-medium text-base-content/60">Generated audio will appear here with an inline player and download action.</h3>
              </div>
            </div>
          </Show>
          <Show when={showProgress() && jobId()}>
            <div class="card bg-base-100 shadow-xl w-full flex-1 flex flex-col p-6">
              <h3 class="font-semibold">Audio Preview</h3>
              <p class="text-sm opacity-60 mt-2">Audio renders as completed. Check Job Media.</p>
            </div>
          </Show>
        </div>
      </form>
      <dialog id="job-action-modal" class="modal"></dialog>
    </div>
  );
}
