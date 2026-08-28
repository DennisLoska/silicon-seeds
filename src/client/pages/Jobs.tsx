import { createResource, createSignal, For, Show } from "solid-js";
import { useParams, useSearchParams, A } from "@solidjs/router";
import { apiGet, type Job } from "../api/client";
import { useJobUpdates } from "../lib/sse";

export default function Jobs(){
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = () => (search.tab as string) || "status";
  const filter = () => (search.filter as string) || "all";
  const jobId = () => params.jobId as string | undefined;

  const [jobs, { refetch }] = createResource(async () => {
    const data = await apiGet<{ jobs: Job[] } | Job[]>("/api/jobs");
    return Array.isArray(data) ? data : (data as any).jobs ?? [];
  });
  // SSE for selected job
  useJobUpdates(jobId, () => refetch());

  return <div class="p-6"><h2 class="text-2xl font-bold">Jobs</h2><p class="text-base-content/60">Jobs list — SolidJS port (TODO full detail)</p><Show when={jobs.loading}><span class="loading loading-spinner" /></Show><Show when={!jobs.loading && (!jobs() || jobs()!.length===0)}><div class="p-6 text-base-content/50">No jobs found</div></Show><For each={jobs() || []}>{(j)=><div class="card bg-base-200 p-4 mb-2"><A href={`/jobs/${j.id}?tab=${tab()}`} class="font-semibold">{j.name}</A><div class="text-sm opacity-60">{j.status} — {j.id.slice(0,8)}</div></div>}</For><Show when={jobId()}><div class="mt-4">Job detail for {jobId()} tab={tab()}</div></Show></div>;
}
