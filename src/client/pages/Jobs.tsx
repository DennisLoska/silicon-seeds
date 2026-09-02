import { createResource, createSignal, For, Show, createEffect, onCleanup } from "solid-js";
import { useParams, useSearchParams, A } from "@solidjs/router";
import { apiGet, type EventRow, getAssetPath } from "../lib/api-client";
import { useJobUpdates } from "../lib/sse";
import { Icons } from "../components/Icons";

type Job = { id: string; name: string; status: string; created_at: string; workflow?: string | null; original_prompt?: string | null; fps?: number; clip_duration?: number; transition_duration?: number; resolution?: string; image_model?: string; video_model?: string; style_preset?: string };

function StatusBadge(props: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    complete: { cls: "badge-success", label: "Complete" },
    failed: { cls: "badge-error", label: "Failed" },
    cancelled: { cls: "badge-neutral", label: "Cancelled" },
    active: { cls: "badge-warning", label: "Active" },
    paused: { cls: "badge-info", label: "Paused" },
  };
  const v = () => map[props.status] ?? map.active;
  return <span class={`badge badge-sm ${v().cls}`}>{v().label}</span>;
}

function formatLabel(v?: string | number | null) {
  if (v === undefined || v === null || v === "") return "Not set";
  return String(v);
}
function calculateDuration(createdAt: string, events: EventRow[]) {
  if (!events.length) return "0h 0m 0s";
  const last = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!last?.created_at) return "0h 0m 0s";
  const ms = new Date(last.created_at).getTime() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export default function Jobs() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = () => (search.tab as string) || "status";
  const filter = () => (search.filter as string) || "all";
  const [filterOpen, setFilterOpen] = createSignal(false);
  const jobIdParam = () => (params.jobId as string | undefined) || (search.job_id as string | undefined);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(jobIdParam());

  // close filter dropdown on outside click
  createEffect(() => {
    if (!filterOpen()) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#job-filter-dropdown")) setFilterOpen(false);
    };
    document.addEventListener("click", handler);
    onCleanup(() => document.removeEventListener("click", handler));
  });

  createEffect(() => {
    const id = jobIdParam();
    if (id && id !== selectedId()) setSelectedId(id);
  });

  const [jobsData, { refetch: refetchJobs }] = createResource(async () => {
    const data = await apiGet<{ jobs: Job[] }>("/api/jobs");
    return data.jobs ?? [];
  });

  const filteredJobs = () => {
    const list = jobsData() ?? [];
    const f = filter();
    if (f === "active") return list.filter((j) => j.status === "active");
    if (f === "complete") return list.filter((j) => j.status === "complete");
    if (f === "failed") return list.filter((j) => j.status === "failed");
    if (f === "cancelled") return list.filter((j) => j.status === "cancelled");
    if (f === "paused") return list.filter((j) => j.status === "paused");
    if (f === "recent") return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  createEffect(() => {
    const list = filteredJobs();
    if (list.length > 0 && !selectedId()) {
      const id = list[0].id;
      setSelectedId(id);
      setSearch({ job_id: id, tab: tab(), filter: filter() }, { replace: true });
    }
  });

  const [jobDetail, { refetch: refetchJobDetail }] = createResource(
    () => selectedId(),
    async (id) => {
      if (!id) return null;
      const data = await apiGet<{ job: Job; events: EventRow[] }>(`/api/jobs/${id}`);
      return data;
    },
  );

  const [eventsData, { refetch: refetchEvents }] = createResource(
    () => selectedId(),
    async (id) => {
      if (!id) return { events: [] as EventRow[], total: 0 };
      const data = await apiGet<{ events: EventRow[]; total: number }>(`/api/jobs/${id}/events?limit=50`);
      return data;
    },
  );

  const [mediaData, { refetch: refetchMedia }] = createResource(
    () => (tab() === "media" ? selectedId() : undefined),
    async (id) => {
      if (!id) return { items: [] as { filename: string; subfolder: string; mediaType: string | null }[], total: 0 };
      const data = await apiGet<{ items: { filename: string; subfolder: string; mediaType: string | null }[]; total: number }>(`/api/jobs/${id}/media?limit=100`);
      return data;
    },
  );

  useJobUpdates(selectedId, () => {
    refetchJobs();
    refetchJobDetail();
    const t = tab();
    if (t === "media") refetchMedia();
    else refetchEvents();
  });

  const job = () => jobDetail()?.job;
  const events = () => jobDetail()?.events ?? eventsData()?.events ?? [];
  const completedCount = () => events().filter((e) => e.status === "complete").length;
  const runningCount = () => events().filter((e) => e.status === "running").length;
  const pendingCount = () => events().filter((e) => e.status === "pending").length;
  const failedCount = () => events().filter((e) => e.status === "failed").length;
  const progress = () => (events().length === 0 ? 0 : Math.round((completedCount() / events().length) * 100));
  const pipelineCounts = () => {
    const evs = events();
    return {
      image: evs.filter((e) => e.type === "NewImagePrompt").length,
      video: evs.filter((e) => e.type === "NewVideoPrompt").length,
      transition: evs.filter((e) => e.type === "NewTransitionPrompt").length,
      audio: evs.filter((e) => e.type === "NewAudioPrompt").length,
    };
  };
  const currentStep = () => events().find((e) => e.status === "running")?.type ?? (completedCount() === events().length && events().length > 0 ? "Complete" : "Queued");

  return (
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-base-100">
      <div class="w-full lg:w-80 xl:w-[420px] bg-base-100 border-r border-base-300 flex flex-col shrink-0 max-h-[calc(100vh-4rem)]">
        <div class="sticky top-0 z-10 bg-base-100 flex gap-2 px-4 py-3 border-b border-base-300">
          <A href="/compose" class="btn btn-primary btn-sm">New Job <Icons.NewJobIcon /></A>
          <div id="job-filter-dropdown" class="relative">
            <button class="btn btn-sm" onClick={(e) => { e.stopPropagation(); setFilterOpen(!filterOpen()); }} aria-haspopup="menu" aria-expanded={filterOpen() ? "true" : "false"}>{filter() === "all" ? "All" : filter().charAt(0).toUpperCase() + filter().slice(1)}</button>
            <Show when={filterOpen()}>
              <ul class="absolute left-0 top-full mt-1 z-20 menu p-2 shadow-lg bg-base-200 rounded-box w-52 border border-base-300">
                <For each={["all", "recent", "active", "complete", "failed", "cancelled", "paused"]}>
                  {(f) => (
                    <li>
                      <a classList={{ "active": filter() === f }} onClick={() => { setSearch({ filter: f, job_id: selectedId(), tab: tab() }); setFilterOpen(false); }}>{f.charAt(0).toUpperCase() + f.slice(1)}</a>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-2 pb-20 lg:pb-2">
          <Show when={jobsData.loading}>
            <div class="flex justify-center py-8"><span class="loading loading-spinner" /></div>
          </Show>
          <Show when={jobsData.error}>
            <div class="alert alert-error text-sm">{String(jobsData.error)}</div>
          </Show>
          <Show when={!jobsData.loading && filteredJobs().length === 0}>
            <div class="p-6 text-base-content/50 text-sm">No jobs yet</div>
          </Show>
          <ul class="list w-full">
            <For each={filteredJobs()}>
              {(j) => (
                <li class={`list-row p-0 flex items-center justify-between rounded-sm shadow-sm mb-1 hover:shadow-md transition-all ${selectedId() === j.id ? "bg-primary text-primary-content" : "hover:bg-base-200 bg-base-100"}`}>
                  <A href={`/jobs/${j.id}?tab=${tab()}&filter=${filter()}`} class="flex items-center gap-3 flex-1 px-4 py-3 min-w-0">
                    <StatusBadge status={j.status} />
                    <div class="flex flex-col items-start min-w-0">
                      <span class="font-semibold text-sm leading-tight truncate max-w-[14ch] lg:max-w-[18ch]">{j.name}</span>
                      <span class="font-mono text-xs opacity-70 truncate">{j.id.slice(0, 8)}…</span>
                      <span class="text-xs opacity-60">{new Date(j.created_at).toLocaleString()}</span>
                    </div>
                  </A>
                  <span class="text-xs opacity-60 hidden lg:inline mr-2">{j.status}</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>

      <div class="flex-1 flex flex-col bg-base-200 relative">
        <Show when={!selectedId()}>
          <div class="flex flex-col items-center justify-center min-h-[400px] text-base-content/60">
            <p>No job selected.</p>
          </div>
        </Show>
        <Show when={selectedId()}>
          <div id="job-tabs-container" class="flex flex-col flex-1">
            <div class="tabs tabs-bordered px-6 py-0 bg-base-100 border-b border-base-300 shadow-sm sticky top-0 z-10">
              <A href={`/jobs/${selectedId()}?tab=status&filter=${filter()}`} class={`tab ${tab() === "status" ? "tab-active border-b-2 border-primary font-medium" : ""}`}>Status</A>
              <A href={`/jobs/${selectedId()}?tab=media&filter=${filter()}`} class={`tab ${tab() === "media" ? "tab-active border-b-2 border-primary font-medium" : ""}`}>Media</A>
              <A href={`/jobs/${selectedId()}?tab=events&filter=${filter()}`} class={`tab ${tab() === "events" ? "tab-active border-b-2 border-primary font-medium" : ""}`}>Events</A>
            </div>
            <div class="flex-1 p-6">
              <Show when={tab() === "status"}>
                <Show when={jobDetail.loading}>
                  <div class="flex justify-center py-12"><span class="loading loading-spinner" /></div>
                </Show>
                <Show when={job()}>
                  {(j) => (
                    <div class="space-y-8">
                      <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h2 class="text-3xl font-extrabold tracking-tight">Status <span class={`badge badge-lg ${j().status === "complete" ? "badge-success" : j().status === "failed" ? "badge-error" : j().status === "cancelled" ? "badge-neutral" : j().status === "paused" ? "badge-info" : "badge-warning"}`}>{j().status}</span></h2>
                          <p class="text-base-content/60 mt-1">Detailed overview of job execution and configuration.</p>
                        </div>
                        <div class="flex gap-2 shrink-0">
                          <Show when={j().status === "active"}>
                            <button class="btn btn-sm btn-warning" onClick={async () => { await fetch(`/api/jobs/${j().id}/pause`, { method: "POST" }); refetchJobs(); refetchJobDetail(); }}>Pause</button>
                          </Show>
                          <Show when={j().status === "paused"}>
                            <button class="btn btn-sm btn-success" onClick={async () => { await fetch(`/api/jobs/${j().id}/resume`, { method: "POST" }); refetchJobs(); refetchJobDetail(); }}>Resume</button>
                          </Show>
                          <Show when={j().status === "failed"}>
                            <button class="btn btn-sm btn-error" onClick={async () => { await fetch(`/api/jobs/${j().id}/retry`, { method: "POST" }); refetchJobs(); refetchJobDetail(); }}>Retry</button>
                          </Show>
                        </div>
                      </header>
                      <div class="card bg-base-100 shadow-sm">
                        <div class="card-body gap-3">
                          <div class="flex items-center justify-between">
                            <h3 class="card-title text-sm uppercase tracking-widest font-bold opacity-60">Progress</h3>
                            <span class="font-bold">{progress()}%</span>
                          </div>
                          <progress class="progress progress-primary w-full" value={progress()} max="100" />
                          <p class="text-sm opacity-70">{completedCount()} of {events().length} events complete.</p>
                        </div>
                      </div>
                      <div class="card bg-base-100 shadow-sm">
                        <div class="card-body gap-3">
                          <h3 class="card-title text-sm uppercase tracking-widest font-bold opacity-60">Original Prompt</h3>
                          <div class="text-sm leading-6 whitespace-pre-wrap break-words opacity-90">{j().original_prompt?.trim() ? j().original_prompt : "Not set"}</div>
                        </div>
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="stats stats-vertical lg:stats-horizontal shadow bg-base-100">
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Job ID</div><div class="stat-value text-sm truncate">{j().id}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Created At</div><div class="stat-value text-sm">{new Date(j().created_at).toLocaleString()}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Job Status</div><div class="stat-value text-sm capitalize">{j().status}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Events</div><div class="stat-value text-sm">{completedCount()} / {events().length}</div></div>
                        </div>
                        <div class="stats stats-vertical lg:stats-horizontal shadow bg-base-100">
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Duration</div><div class="stat-value text-sm">{calculateDuration(j().created_at, events())}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Running</div><div class="stat-value text-sm">{runningCount()}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Pending</div><div class="stat-value text-sm">{pendingCount()}</div></div>
                          <div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Failed</div><div class="stat-value text-sm">{failedCount()}</div></div>
                        </div>
                      </div>
                      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="card bg-base-100 shadow-sm">
                          <div class="card-body">
                            <h3 class="card-title text-sm uppercase tracking-widest font-bold opacity-60">Render Settings</h3>
                            <div class="grid grid-cols-2 gap-3 text-sm mt-2">
                              <div><div class="opacity-60">Resolution</div><div class="font-semibold">{formatLabel(j().resolution)}</div></div>
                              <div><div class="opacity-60">FPS</div><div class="font-semibold">{formatLabel(j().fps)}</div></div>
                              <div><div class="opacity-60">Clip Duration</div><div class="font-semibold">{j().clip_duration ? `${j().clip_duration}s` : "Not set"}</div></div>
                              <div><div class="opacity-60">Transition</div><div class="font-semibold">{j().transition_duration ? `${j().transition_duration}s` : "Not set"}</div></div>
                            </div>
                          </div>
                        </div>
                        <div class="card bg-base-100 shadow-sm">
                          <div class="card-body">
                            <h3 class="card-title text-sm uppercase tracking-widest font-bold opacity-60">Models</h3>
                            <div class="grid grid-cols-1 gap-3 text-sm mt-2">
                              <div><div class="opacity-60">Image Model</div><div class="font-semibold">{formatLabel(j().image_model)}</div></div>
                              <div><div class="opacity-60">Video Model</div><div class="font-semibold">{formatLabel(j().video_model)}</div></div>
                              <div><div class="opacity-60">Style Preset</div><div class="font-semibold">{formatLabel(j().style_preset)}</div></div>
                            </div>
                          </div>
                        </div>
                        <div class="card bg-base-100 shadow-sm">
                          <div class="card-body">
                            <h3 class="card-title text-sm uppercase tracking-widest font-bold opacity-60">Pipeline</h3>
                            <div class="grid grid-cols-2 gap-3 text-sm mt-2">
                              <div><div class="opacity-60">Images</div><div class="font-semibold">{pipelineCounts().image}</div></div>
                              <div><div class="opacity-60">Videos</div><div class="font-semibold">{pipelineCounts().video}</div></div>
                              <div><div class="opacity-60">Transitions</div><div class="font-semibold">{pipelineCounts().transition}</div></div>
                              <div><div class="opacity-60">Audio</div><div class="font-semibold">{pipelineCounts().audio}</div></div>
                              <div class="col-span-2"><div class="opacity-60">Current Step</div><div class="font-semibold">{currentStep()}</div></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>
              </Show>
              <Show when={tab() === "media"}>
                <Show when={mediaData.loading}>
                  <div class="flex justify-center py-8"><span class="loading loading-spinner" /></div>
                </Show>
                <Show when={!mediaData.loading}>
                  {(() => {
                    const items = mediaData()?.items ?? [];
                    const images = items.filter((i) => i.mediaType === "image");
                    const videos = items.filter((i) => i.mediaType === "video");
                    const audios = items.filter((i) => i.mediaType === "audio");
                    const pending = items.length === 0;
                    return (
                      <div class="space-y-8">
                        <Show when={pending}>
                          <div class="text-base-content/60">No media yet for this job.</div>
                        </Show>
                        <Show when={images.length > 0}>
                          <div>
                            <h3 class="font-bold uppercase tracking-widest text-sm opacity-60 mb-3">Images</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <For each={images}>
                                {(m) => (
                                  <div class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
                                    <figure class="bg-base-300"><img src={getAssetPath(m.subfolder, m.filename)} alt={m.filename} class="w-full aspect-video object-cover" loading="lazy" /></figure>
                                    <div class="card-body p-3"><p class="text-xs truncate opacity-60">{m.filename}</p></div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                        <Show when={videos.length > 0}>
                          <div>
                            <h3 class="font-bold uppercase tracking-widest text-sm opacity-60 mb-3">Videos</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <For each={videos}>
                                {(m) => (
                                  <div class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
                                    <figure class="bg-base-300"><video src={getAssetPath(m.subfolder, m.filename)} controls class="w-full aspect-video object-cover" preload="metadata" /></figure>
                                    <div class="card-body p-3"><p class="text-xs truncate opacity-60">{m.filename}</p></div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                        <Show when={audios.length > 0}>
                          <div>
                            <h3 class="font-bold uppercase tracking-widest text-sm opacity-60 mb-3">Audio</h3>
                            <div class="grid grid-cols-1 gap-4">
                              <For each={audios}>
                                {(m) => (
                                  <div class="card bg-base-100 shadow-sm border border-base-300 p-3 flex flex-row items-center gap-3">
                                    <Icons.Audio />
                                    <span class="text-xs truncate opacity-60 flex-1">{m.filename}</span>
                                    <audio controls src={getAssetPath(m.subfolder, m.filename)} class="h-8" />
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                      </div>
                    );
                  })()}
                </Show>
              </Show>
              <Show when={tab() === "events"}>
                <Show when={events().length === 0}>
                  <div class="p-6 text-center text-base-content/60">Events will appear here once the job runs.</div>
                </Show>
                <Show when={events().length > 0}>
                  <ul class="timeline timeline-compact timeline-vertical">
                    <For each={events()}>
                      {(evt, idx) => {
                        const isComplete = () => evt.status === "complete";
                        const label = () => {
                          const map: Record<string, string> = {
                            new_text_prompt: "Text Prompt",
                            new_image_prompt: "Image Prompt",
                            new_video_prompt: "Video Prompt",
                            new_video_composition: "Final Composition",
                            new_transition_prompt: "Transition Prompt",
                            new_audio_prompt: "Audio Prompt",
                            NewTextPrompt: "Text Prompt",
                            NewImagePrompt: "Image Prompt",
                            NewVideoPrompt: "Video Prompt",
                            NewVideoComposition: "Final Composition",
                            NewTransitionPrompt: "Transition Prompt",
                            NewAudioPrompt: "Audio Prompt",
                          };
                          return map[evt.type] ?? evt.type;
                        };
                        const icon = () => {
                          const map: Record<string, string> = {
                            new_text_prompt: "🖊️",
                            new_image_prompt: "🖼️",
                            new_video_prompt: "🎬",
                            new_video_composition: "🏁",
                            new_transition_prompt: "🔄",
                            new_audio_prompt: "🎵",
                            NewTextPrompt: "🖊️",
                            NewImagePrompt: "🖼️",
                            NewVideoPrompt: "🎬",
                            NewVideoComposition: "🏁",
                            NewTransitionPrompt: "🔄",
                            NewAudioPrompt: "🎵",
                          };
                          return map[evt.type] ?? "📌";
                        };
                        const timestamp = () => new Date(evt.created_at).toLocaleString();
                        return (
                          <li style="content-visibility:auto; contain-intrinsic-size: 200px 300px;">
                            {idx() !== 0 && <hr class={isComplete() ? "bg-success" : ""} />}
                            <div class="timeline-end timeline-box w-[98%] border border-base-300 bg-base-100 min-w-72 max-w-full">
                              <details class="w-full bg-base-100 open:bg-base-100">
                                <summary class="cursor-pointer list-none p-4 hover:bg-base-200 rounded-lg transition-colors">
                                  <div class="flex items-center justify-between gap-4">
                                    <div class="flex items-center gap-1">
                                      <span class="text-sm font-bold text-base-content/60">{label()}</span>
                                      <span class="text-xs text-base-content/40 whitespace-nowrap">{timestamp()}</span>
                                    </div>
                                    <span class={isComplete() ? "badge badge-success text-xs" : "badge badge-warning text-xs"}>
                                      {isComplete() ? <Icons.StatusCompleteSmall /> : <Icons.StatusPendingSmall />}
                                    </span>
                                  </div>
                                </summary>
                                <div class="p-4 pt-0 mt-4 space-y-3 rounded-b-lg">
                                  <div class="flex flex-wrap gap-2">
                                    <span class="badge badge-secondary text-xs">{evt.mode}</span>
                                    <span class="badge badge-ghost text-xs">{evt.type}</span>
                                    <Show when={evt.prompt}>
                                      <span class="badge badge-primary text-xs">has prompt</span>
                                    </Show>
                                  </div>
                                  <Show when={evt.prompt}>
                                    <div>
                                      <p class="text-sm font-medium mb-1 text-base-content/60">Prompt:</p>
                                      <div class="prompt-text overflow-y-auto p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">{evt.prompt}</div>
                                    </div>
                                  </Show>
                                  <Show when={evt.text}>
                                    <div>
                                      <p class="text-sm font-medium mb-1 text-base-content/60">Text:</p>
                                      <div class="prompt-text overflow-y-auto p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">{evt.text}</div>
                                    </div>
                                  </Show>
                                  <Show when={evt.lyrics}>
                                    <div>
                                      <p class="text-sm font-medium mb-1 text-base-content/60">Lyrics:</p>
                                      <div class="prompt-text overflow-y-auto p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">{evt.lyrics}</div>
                                    </div>
                                  </Show>
                                  <Show when={evt.error}>
                                    <div class="text-sm text-error">{evt.error}</div>
                                  </Show>
                                </div>
                              </details>
                            </div>
                            <div class="timeline-middle">
                              <div class={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm ${isComplete() ? "bg-gradient-to-br from-success to-success/70" : "bg-base-200"}`}>
                                {icon()}
                              </div>
                            </div>
                            {idx() !== events().length - 1 && <hr class={isComplete() ? "bg-success" : ""} />}
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
              </Show>
            </div>
          </div>
        </Show>

        {/* Mobile FAB: view selected job details - fixed bottom, lg:hidden. Shadcn alternative would be Sheet/Drawer for detail, but spec asks for FAB navigating to detail page. */}
        <Show when={selectedId()}>
          <div class="lg:hidden fixed bottom-0 inset-x-0 z-30 p-4 bg-base-100/95 backdrop-blur border-t border-base-300">
            <A
              href={`/jobs/${selectedId()}?tab=${tab()}&filter=${filter()}`}
              onClick={(e) => {
                // on mobile stacked view, smooth-scroll to details pane instead of just staying at list
                const el = document.getElementById("job-tabs-container");
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  // also push URL so back button works
                  history.pushState(null, "", `/jobs/${selectedId()}?tab=${tab()}&filter=${filter()}`);
                }
              }}
              class="btn btn-primary w-full shadow-lg"
            >
              View Job Details - {selectedId()?.slice(0, 8)}…
              <Icons.StatusCompleteSmall />
            </A>
          </div>
        </Show>
      </div>
    </div>
  );
}
