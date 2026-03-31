import { Templates } from "./templates";

export const jobDetail = (jobId: string, activeTab?: string) => {
  const currentTab = activeTab || "status";
  let contentFragment;

  switch (currentTab) {
    case "status":
      contentFragment = Templates.statusFragment(jobId, currentTab);
      break;
    case "media":
      contentFragment = Templates.mediaFragment(jobId, currentTab);
      break;
    case "events":
      contentFragment = Templates.eventsFragment(jobId, currentTab);
      break;
    default:
      contentFragment = Templates.statusFragment(jobId, "status");
  }

  return (
    <div id="job-tabs-container" data-job-id={jobId}>
      <div class="tabs tabs-box mb-6" role="tablist">
        <button
          class={`tab ${currentTab === "status" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=status`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
        >
          Status
        </button>
        <button
          class={`tab ${currentTab === "media" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=media`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
        >
          Media
        </button>
        <button
          class={`tab ${currentTab === "events" ? "tab-active" : ""}`}
          hx-get={`/fragment/${jobId}?tab=events`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
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
