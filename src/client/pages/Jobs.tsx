import { createResource, createSignal, For, Show, createEffect } from "solid-js";
import { useParams, useSearchParams, A } from "@solidjs/router";
import { apiGet, type EventRow, getAssetPath } from "../api/client";
import { useJobUpdates } from "../lib/sse";
import { Icons } from "../components/Icons";

type Job = { id: string; name: string; status: string; created_at: string; workflow?: string | null; original_prompt?: string | null; fps?: number; clip_duration?: number; transition_duration?: number; resolution?: string; image_model?: string; video_model?: string; style_preset?: string };

function StatusBadge(props: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    complete: { cls: "badge-success", label: "Complete" },
    failed: { cls: "badge-error", label: "Failed" },
    cancelled: { cls: "badge-neutral", label: "Cancelled" },
    active: { cls: "badge-warning", label: "Active" },
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
  const jobIdParam = () => (params.jobId as string | undefined) || (search.job_id as string | undefined);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(jobIdParam());

  // sync URL -> selectedId (one-way, no loop)
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
    if (f === "recent") return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    return list;
  };

  // auto-select first filtered job when none selected and list loaded
  createEffect(() => {
    const list = filteredJobs();
    if (list.length > 0 && !selectedId()) {
      const id = list[0].id;
      setSelectedId(id);
      setSearch({ job_id: id, tab: tab(), filter: filter() }, { replace: true });
    }
  });

  // job detail (job + events) for selectedId
  const [jobDetail] = createResource(
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
      const data = await apiGet<{ items: { filename: string; subfolder: string; mediaType: string | null }[]; total: number }>(`/api/jobs/${id}/media?limit=24`);
      return data;
    },
  );

  useJobUpdates(selectedId, () => {
    refetchJobs();
    const t = tab();
    if (t === "media") refetchMedia();
    else refetchEvents();
    // keep detail in sync by refetching jobs/events (jobDetail uses same endpoint, will update on next read if needed)
  });

  const job = () => jobDetail()?.job;
  const events = () => jobDetail()?.events ?? eventsData()?.events ?? [];
  const completedCount = () => events().filter((e) => e.status === "complete").length;
  const progress = () => (events().length === 0 ? 0 : Math.round((completedCount() / events().length) * 100));

  return (
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)] bg-base-100">
      {/* Sidebar list */}
      <div class="w-full lg:w-80 xl:w-[420px] bg-base-100 border-r border-base-300 flex flex-col shrink-0">
        <div class="sticky top-0 z-10 bg-base-100 flex gap-2 px-4 py-3 border-b border-base-300">
          <A href="/compose" class="btn btn-primary btn-sm">New Job <Icons.NewJobIcon /></A>
          <details class="dropdown">
            <summary class="btn btn-sm">{filter() === "all" ? "All" : filter().charAt(0).toUpperCase() + filter().slice(1)}</summary>
            <ul class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1.5">
              <For each={["all", "recent", "active", "complete", "failed", "cancelled"]}>
                {(f) => (
                  <li>
                    <a onClick={() => setSearch({ filter: f, job_id: selectedId(), tab: tab() })}>{f.charAt(0).toUpperCase() + f.slice(1)}</a>
                  </li>
                )}
              </For>
            </ul>
          </details>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
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
                  <A
                    href={`/jobs/${j.id}?tab=${tab()}&filter=${filter()}`}
                    class="flex items-center gap-3 flex-1 px-4 py-3 min-w-0"
                  >
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

      {/* Detail area */}
      <div class="flex-1 flex flex-col min-h-0 bg-base-200">
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
            <div class="flex-1 p-6 overflow-y-auto">
              <Show when={tab() === "status"}>
                <Show when={jobDetail.loading}>
                  <div class="flex justify-center py-12"><span class="loading loading-spinner" /></div>
                </Show>
                <Show when={job()}>
                  {(j) => (
                    <div class="space-y-8">
                      <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h2 class="text-3xl font-extrabold tracking-tight">Status <span class={`badge badge-xl ${j().status === "complete" ? "badge-success" : j().status === "failed" ? "badge-error" : j().status === "cancelled" ? "badge-neutral" : "badge-warning"}`}>{j().status}</span></h2>
                          <p class="text-base-content/60 mt-1">Detailed overview of job execution and configuration.</p>
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
                      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Job ID</div><div class="stat-value text-sm truncate">{j().id}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Created At</div><div class="stat-value text-sm">{new Date(j().created_at).toLocaleString()}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Job Status</div><div class="stat-value text-sm capitalize">{j().status}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Events</div><div class="stat-value text-sm">{completedCount()} / {events().length}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Duration</div><div class="stat-value text-sm">{calculateDuration(j().created_at, events())}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">FPS</div><div class="stat-value text-sm">{formatLabel(j().fps)}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Resolution</div><div class="stat-value text-sm">{formatLabel(j().resolution)}</div></div></div>
                        <div class="stats shadow bg-base-100"><div class="stat"><div class="stat-title text-xs uppercase opacity-60 font-bold">Style Preset</div><div class="stat-value text-sm">{formatLabel(j().style_preset)}</div></div></div>
                      </div>
                    </div>
                  )}
                </Show>
              </Show>
              <Show when={tab() === "media"}>
                <Show when={mediaData.loading}>
                  <div class="flex justify-center py-8"><span class="loading loading-spinner" /></div>
                </Show>
                <Show when={!mediaData.loading && (mediaData()?.items?.length ?? 0) === 0}>
                  <div class="text-base-content/60">No media yet for this job.</div>
                </Show>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <For each={mediaData()?.items ?? []}>
                    {(m) => (
                      <div class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
                        <figure class="bg-base-300">
                          <Show when={m.mediaType === "video"} fallback={<img src={getAssetPath(m.subfolder, m.filename)} alt={m.filename} class="w-full aspect-video object-cover" loading="lazy" />}>
                            <video src={getAssetPath(m.subfolder, m.filename)} controls class="w-full aspect-video object-cover" preload="metadata" />
                          </Show>
                        </figure>
                        <div class="card-body p-3"><p class="text-xs truncate opacity-60">{m.filename}</p></div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={tab() === "events"}>
                <div class="space-y-2">
                  <For each={events()}>
                    {(ev) => (
                      <div class="card bg-base-100 p-4 shadow-sm">
                        <div class="flex gap-2 items-center">
                          <span class="badge badge-sm">{ev.mode}</span>
                          <span class="font-mono text-sm">{ev.type}</span>
                          <span class={`ml-auto badge badge-sm ${ev.status === "complete" ? "badge-success" : ev.status === "failed" ? "badge-error" : ev.status === "pending" ? "badge-ghost" : "badge-warning"}`}>{ev.status}</span>
                        </div>
                        <Show when={ev.prompt}><div class="mt-2 text-sm whitespace-pre-wrap break-words opacity-80">{ev.prompt}</div></Show>
                        <Show when={ev.text}><pre class="mt-2 text-xs whitespace-pre-wrap bg-base-200 p-2 rounded">{ev.text}</pre></Show>
                        <Show when={ev.error}><div class="mt-2 text-sm text-error">{ev.error}</div></Show>
                        <div class="text-xs opacity-50 mt-2">{new Date(ev.created_at).toLocaleString()}</div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
