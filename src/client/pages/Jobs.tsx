import { createResource, createSignal, For, Show, createEffect } from "solid-js";
import { useParams, useSearchParams, A } from "@solidjs/router";
import { apiGet, type EventRow } from "../api/client";
import { useJobUpdates } from "../lib/sse";
import { Icons } from "../components/Icons";

type Job = { id: string; name: string; status: string; created_at: string; workflow?: string | null };

function StatusBadge(props: { status: string }) {
  const s = () => props.status;
  return (
    <Show when={s() === "complete"} fallback={<Show when={s() === "failed"} fallback={<Show when={s() === "cancelled"} fallback={<span class="badge badge-warning badge-sm"><Icons.StatusPendingSmall /> Active</span>}><span class="badge badge-neutral badge-sm"><Icons.StatusCancelledSmall /> Cancelled</span></Show>}><span class="badge badge-error badge-sm"><Icons.StatusFailedSmall /> Failed</span></Show>}>
      <span class="badge badge-success badge-sm"><Icons.StatusCompleteSmall /> Complete</span>
    </Show>
  );
}

export default function Jobs() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = () => (search.tab as string) || "status";
  const jobIdParam = () => (params.jobId as string | undefined) || (search.job_id as string | undefined);
  const [selectedId, setSelectedId] = createSignal<string | undefined>(jobIdParam());

  createEffect(() => {
    const id = jobIdParam();
    if (id) setSelectedId(id);
  });

  const [jobsData, { refetch: refetchJobs }] = createResource(async () => {
    const data = await apiGet<{ jobs: Job[] }>("/api/jobs");
    return data.jobs ?? [];
  });

  // Auto-select first job if none selected
  createEffect(() => {
    const list = jobsData();
    if (list && list.length > 0 && !selectedId()) {
      setSelectedId(list[0].id);
      setSearch({ job_id: list[0].id, tab: tab() });
    }
  });

  // Events for selected job
  const [eventsData, { refetch: refetchEvents }] = createResource(
    () => selectedId(),
    async (id) => {
      if (!id) return { events: [] as EventRow[], total: 0 };
      const data = await apiGet<{ events: EventRow[]; total: number }>(`/api/jobs/${id}/events?limit=50`);
      return data;
    },
  );

  useJobUpdates(selectedId, () => {
    refetchJobs();
    refetchEvents();
  });

  return (
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
      {/* Sidebar list */}
      <div class="w-full lg:w-80 xl:w-96 bg-base-200 border-r border-base-300 flex flex-col">
        <div class="p-4 flex-1 overflow-y-auto">
          <Show when={jobsData.loading}>
            <div class="flex justify-center py-8"><span class="loading loading-spinner" /></div>
          </Show>
          <Show when={!jobsData.loading && (!jobsData() || jobsData()!.length === 0)}>
            <div class="p-6 text-base-content/50">No jobs found</div>
          </Show>
          <For each={jobsData() || []}>
            {(j) => (
              <A
                href={`/jobs/${j.id}?tab=${tab()}`}
                onClick={() => setSelectedId(j.id)}
                class={`card bg-base-100 shadow-sm mb-2 hover:bg-base-300 cursor-pointer ${selectedId() === j.id ? "ring-2 ring-primary" : ""}`}
              >
                <div class="card-body p-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold truncate text-sm">{j.name}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <div class="text-xs opacity-60 truncate">{j.id.slice(0, 8)} • {j.workflow || "unknown"}</div>
                </div>
              </A>
            )}
          </For>
        </div>
      </div>

      {/* Detail area */}
      <div class="flex-1 flex flex-col min-h-0">
        <Show when={!selectedId()}>
          <div class="flex flex-col items-center justify-center min-h-[400px] text-base-content/60">
            <p>No job selected.</p>
          </div>
        </Show>
        <Show when={selectedId()}>
          <div id="job-tabs-container" class="flex flex-col flex-1">
            <div class="tabs tabs-bordered px-4 pt-2 bg-base-100">
              <A href={`/jobs/${selectedId()}?tab=status`} class={`tab ${tab() === "status" ? "tab-active" : ""}`}>Status</A>
              <A href={`/jobs/${selectedId()}?tab=media`} class={`tab ${tab() === "media" ? "tab-active" : ""}`}>Media</A>
              <A href={`/jobs/${selectedId()}?tab=events`} class={`tab ${tab() === "events" ? "tab-active" : ""}`}>Events</A>
            </div>
            <div class="flex-1 p-4 bg-base-100 overflow-y-auto">
              <Show when={tab() === "status"}>
                <div class="space-y-2">
                  <h3 class="font-bold">Job {selectedId()}</h3>
                  <div class="stats shadow w-full">
                    <div class="stat"><div class="stat-title">Events</div><div class="stat-value text-lg">{eventsData()?.total ?? 0}</div></div>
                    <div class="stat"><div class="stat-title">Status</div><div class="stat-value text-lg">{jobsData()?.find((j) => j.id === selectedId())?.status ?? ""}</div></div>
                  </div>
                  <For each={eventsData()?.events || []}>
                    {(ev) => (
                      <div class="card bg-base-200 p-3 text-sm">
                        <div class="flex justify-between"><span class="font-mono">{ev.type}</span><span class={`badge ${ev.status === "complete" ? "badge-success" : ev.status === "failed" ? "badge-error" : "badge-warning"}`}>{ev.status}</span></div>
                        <Show when={ev.prompt}><div class="truncate opacity-70">{ev.prompt}</div></Show>
                        <Show when={ev.error}><div class="text-error truncate">{ev.error}</div></Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={tab() === "media"}>
                <div class="text-base-content/60">Media view for {selectedId()} — images/videos/audio will appear here.</div>
              </Show>
              <Show when={tab() === "events"}>
                <div class="space-y-2">
                  <For each={eventsData()?.events || []}>
                    {(ev) => (
                      <div class="card bg-base-200 p-3">
                        <div class="flex gap-2 items-center"><span class="badge badge-sm">{ev.mode}</span><span class="font-mono text-sm">{ev.type}</span><span class="ml-auto badge badge-sm">{ev.status}</span></div>
                        <Show when={ev.text}><pre class="mt-2 text-xs whitespace-pre-wrap">{ev.text}</pre></Show>
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
