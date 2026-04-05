import { Templates } from "./templates";
import { DB } from "../db/db";
import { Job } from "../events/events";

export const jobDetail = async (jobId: string, activeTab?: string) => {
  const job: Job = await DB.Jobs.findById(jobId);

  if (!job) return <div className="p-6 text-error font-bold">Job not found</div>;

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
      {/* Tabs Section - Dedicated section with background and border, snaps to header/sidebar */}
      <div className="bg-base-200 px-6 py-1 -mt-6 rounded-t-lg border-b border-base-300">
        <div className="tabs tabs-bordered w-full" role="tablist">
          <button
            className={`tab ${currentTab === "status" ? "tab-active" : ""}`}
            hx-get={`/api/fragment/${jobId}?tab=status`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=status`}
          >
            Status
          </button>
          <button
            className={`tab ${currentTab === "media" ? "tab-active" : ""}`}
            hx-get={`/api/fragment/${jobId}?tab=media`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=media`}
          >
            Media
          </button>
          <button
            className={`tab ${currentTab === "events" ? "tab-active" : ""}`}
            hx-get={`/api/fragment/${jobId}?tab=events`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=events`}
          >
            Events
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="breadcrumbs mb-6">
        <ul>
          <li>
            <a
              hx-get={`/api/jobs/list-view?page=jobs&current_id=${jobId}`}
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url={`/?page=jobs&current_id=${jobId}`}
            >
              Jobs
            </a>
          </li>
          <li>
            <span className="text-base-content/60">{jobId}</span>
          </li>
        </ul>
      </div>

      {/* Content Area */}
      <div id="job-content-area" className="min-h-[500px]">
        {contentFragment}
      </div>
    </div>
  );
};