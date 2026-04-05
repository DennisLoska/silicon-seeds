import { Templates } from "./templates";
import { DB } from "../db/db";
import { Job } from "../events/events";
import { truncateJobId } from "./utils";

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
      <div className="bg-base-200 px-6 py-0 -mt-6 mx-[-1.5rem] rounded-t-lg border-b border-base-300">
        <div className="tabs w-full" role="tablist">
          <button
            className={`tab rounded-t-lg ${currentTab === "status" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
            hx-get={`/api/fragment/job/${jobId}?tab=status`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=status`}
          >
            Status
          </button>
          <button
            className={`tab rounded-t-lg ${currentTab === "media" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
            hx-get={`/api/fragment/job/${jobId}?tab=media`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=media`}
          >
            Media
          </button>
          <button
            className={`tab rounded-t-lg ${currentTab === "events" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
            hx-get={`/api/fragment/job/${jobId}?tab=events`}
            hx-target="#job-tabs-container"
            hx-swap="innerHTML"
            hx-push-url={`?job_id=${jobId}&tab=events`}
          >
            Events
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="breadcrumbs mt-2 mb-4">
        <ul>
          <li>
            <a
              hx-get="/api/jobs/list-view?page=jobs"
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url="/"
            >
              Jobs
            </a>
          </li>
          <li>
            <span className="text-base-content/60 lg:hidden" style={{ maxWidth: '8ch', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncateJobId(jobId)}</span>
            <span className="text-base-content/60 hidden lg:inline">{jobId}</span>
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