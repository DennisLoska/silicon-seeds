import { Templates } from "./templates";
import { DB } from "../db/db";
import { Job } from "../events/events";

export const jobDetail = async (jobId: string, activeTab?: string) => {
  const job: Job = await DB.Jobs.findById(jobId);
  if (!job) return <div class="p-6 text-error font-bold">Job not found</div>;

  const currentTab = activeTab || "status";
  let contentFragment;

  switch (currentTab) {
    case "status":
      contentFragment = Templates.statusFragment(job);
      break;
    case "media":
      contentFragment = Templates.mediaFragment(job);
      break;
    case "events":
      contentFragment = Templates.eventsFragment(job);
      break;
    default:
      contentFragment = Templates.statusFragment(job);
  }

  return (
    <div id="job-tabs-container" data-job-id={jobId}>
      <div class="tabs tabs-bordered mb-8" role="tablist">
        <button
          class={`tab ${currentTab === "status" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=status`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
          hx-push-url={`?job_id=${jobId}&tab=status`}
        >
          Status
        </button>
        <button
          class={`tab ${currentTab === "media" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=media`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
          hx-push-url={`?job_id=${jobId}&tab=media`}
        >
          Media
        </button>
        <button
          class={`tab ${currentTab === "events" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=events`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
          hx-push-url={`?job_id=${jobId}&tab=events`}
        >
          Events
        </button>
      </div>

      <div id="job-content-area" class="min-h-[400px]">
        {contentFragment}
      </div>
    </div>
  );
};
