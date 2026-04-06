import { Templates } from "./templates";
import { DB } from "../db/db";
import { Job } from "../events/events";
import { truncateJobId } from "./utils";
import { Icons } from "./icons";

const filterMap = {
  all: "All",
  recent: "Recent",
  pending: "Pending",
  completed: "Completed",
} as const;

export const jobDetailContent = async (jobId: string, activeTab?: string) => {
  const job: Job = await DB.Jobs.findById(jobId);

  if (!job) {
    return <div className="p-6 text-error font-bold">Job not found!</div>;
  }

  const currentTab = activeTab || "status";
  let contentFragment;

  switch (currentTab) {
    case "status":
      contentFragment = Templates.statusFragment(job);
      break;
    case "media":
      // Fetch media data and pass to template
      const events = await DB.Events.findByJobId(jobId);
      const mediaData: {
        images: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        videos: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        audio: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        pending: Array<{
          mode: string;
          filename: string | null;
          status: string;
        }>;
      } = {
        images: [],
        videos: [],
        audio: [],
        pending: [],
      };

      for (const event of events) {
        if (event.status === "pending") {
          mediaData.pending.push({
            mode: event.mode,
            filename: (event as any).filename ?? null,
            status: event.status,
          });
        } else {
          const meta = await DB.Meta.findByEventId(event.id).catch(() => null);
          if (meta) {
            if (event.mode === "image") {
              mediaData.images.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            } else if (event.mode === "video") {
              mediaData.videos.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            } else if (
              event.mode === "speech" ||
              event.mode === "instrumental"
            ) {
              mediaData.audio.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            }
          }
        }
      }
      contentFragment = Templates.mediaFragment(job, mediaData);
      break;
    case "events":
      contentFragment = Templates.eventsFragment(job);
      break;
    default:
      contentFragment = Templates.statusFragment(job);
  }

  return contentFragment;
};

// Helper function to render just the sidebar (for HTMX partial updates)
const jobSidebar = async (activeJobId: string, filter: string, tab: string) => {
  let jobs = await DB.Jobs.list();

  // Apply filter if specified
  if (filter === "recent") {
    jobs = jobs
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5);
  } else if (filter === "completed") {
    const completedJobIds = new Set<string>();
    for (const jobItem of jobs) {
      const jobEvents = await DB.Events.findByJobId(jobItem.id);
      const hasCompleteEvent = jobEvents.some((e) => e.status === "complete");
      if (hasCompleteEvent) completedJobIds.add(jobItem.id);
    }
    jobs = jobs.filter((j) => completedJobIds.has(j.id));
  } else if (filter === "pending") {
    const pendingJobIds = new Set<string>();
    for (const jobItem of jobs) {
      const jobEvents = await DB.Events.findByJobId(jobItem.id);
      const hasCompleteEvent = jobEvents.some((e) => e.status === "complete");
      if (!hasCompleteEvent) pendingJobIds.add(jobItem.id);
    }
    jobs = jobs.filter((j) => pendingJobIds.has(j.id));
  }

  // Pre-fetch all job events for status badges
  const jobStatusMap = new Map<string, { isCompleted: boolean }>();
  for (const jobItem of jobs) {
    const jobEvents = await DB.Events.findByJobId(jobItem.id);
    jobStatusMap.set(jobItem.id, {
      isCompleted: jobEvents.some((e) => e.status === "complete"),
    });
  }

  if (jobs.length === 0) {
    return (
      <div className="space-y-4">
        <ul className="list rounded-sm w-full lg:w-2/3 flex-start">
          <li className="list-row px-4 py-2 text-sm text-base-content/50">
            No jobs yet
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div id="job-sidebar">
      {/* Filter dropdown - wrapped for hx-target inheritance */}
      <div className="sticky top-0 z-10 bg-base-100 flex gap-2 px-4 py-0 pt-4 pb-4">
        <button
          className="btn btn-primary btn-md flex justify-end"
          hx-post="/api/jobs/images"
          hx-trigger="click"
        >
          New Job
          {Icons.NEW_JOB_ICON}
        </button>
        <details className="dropdown">
          <summary className="btn btn-md">
            {filterMap[filter as keyof typeof filterMap]}
          </summary>
          <ul className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mt-1.5">
            <li>
              <a
                hx-get="/jobs?filter=all"
                hx-target="#job-details"
                hx-swap="outerHTML"
                hx-push-url="/jobs?filter=all"
              >
                All
              </a>
            </li>
            <li>
              <a
                hx-get="/jobs?filter=recent"
                hx-target="#job-details"
                hx-swap="outerHTML"
                hx-push-url="/jobs?filter=recent"
              >
                Recent
              </a>
            </li>
            <li>
              <a
                hx-get="/jobs?filter=pending"
                hx-target="#job-details"
                hx-swap="outerHTML"
                hx-push-url="/jobs?filter=pending"
              >
                Pending
              </a>
            </li>
            <li>
              <a
                hx-get="/jobs?filter=completed"
                hx-target="#job-details"
                hx-swap="outerHTML"
                hx-push-url="/jobs?filter=completed"
              >
                Completed
              </a>
            </li>
          </ul>
        </details>
      </div>

      <ul className="list max-w-[420px]">
        {jobs.map((jobItem) => {
          const date = new Date(jobItem.created_at).toLocaleString();
          const isActive = activeJobId === jobItem.id;
          const statusInfo = jobStatusMap.get(jobItem.id);
          const isCompleted = statusInfo?.isCompleted ?? false;

          return (
            <li
              key={jobItem.id}
              className={`list-row p-0 flex items-center justify-between rounded-sm shadow-sm hover:shadow-md transition-all ${isActive ? "bg-primary text-primary-content" : "hover:bg-base-300"}`}
            >
              <div
                className="flex items-center gap-2 cursor-pointer flex-grow-1 w-full h-full px-4 py-3"
                hx-get={`/jobs?job_id=${jobItem.id}&tab=status`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`/jobs?job_id=${jobItem.id}&filter=${filter}&tab=${tab}`}
              >
                <span
                  className={`badge ${isCompleted ? "badge-success" : "badge-warning"}`}
                >
                  {
                    Icons.STATUS_ICONS_SMALL[
                      isCompleted ? "complete" : "pending"
                    ]
                  }
                </span>
                <div className="flex flex-col items-start">
                  <span
                    className="font-bold text-sm lg:hidden"
                    style={{
                      maxWidth: "8ch",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {truncateJobId(jobItem.id)}
                  </span>
                  <span className="font-bold text-sm hidden lg:inline">
                    {jobItem.id}
                  </span>
                  <span className="text-xs opacity-60">{date}</span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm mr-4"
                hx-get={`/api/fragment/delete-modal?jobId=${jobItem.id}`}
                hx-target="#delete-confirm-modal"
                hx-swap="outerHTML"
                title="Delete job"
              >
                {Icons.DELETE_ICON}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const tabs = (jobId: string, filter: string, tab: string) => (
  <div className="bg-base-200 px-6 py-0 -mt-6 mx-[-1.5rem] rounded-t-lg border-b border-base-300">
    <div className="tabs w-full" role="tablist">
      <button
        className={`tab rounded-t-lg ${tab === "status" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
        hx-get={`/api/fragment/job/${jobId}?tab=status`}
        hx-target="#job-tabs-container"
        hx-swap="innerHTML"
        hx-push-url={`/jobs?job_id=${jobId}&filter=${filter}&tab=status`}
      >
        Status
      </button>
      <button
        className={`tab rounded-t-lg ${tab === "media" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
        hx-get={`/api/fragment/job/${jobId}?tab=media`}
        hx-target="#job-tabs-container"
        hx-swap="innerHTML"
        hx-push-url={`/jobs?job_id=${jobId}&filter=${filter}&tab=media`}
      >
        Media
      </button>
      <button
        className={`tab rounded-t-lg ${tab === "events" ? "tab-active bg-primary text-primary-content border-b-4 border-primary" : ""}`}
        hx-get={`/api/fragment/job/${jobId}?tab=events`}
        hx-target="#job-tabs-container"
        hx-swap="innerHTML"
        hx-push-url={`jobs?job_id=${jobId}&filter=${filter}&tab=events`}
      >
        Events
      </button>
    </div>
  </div>
);

export const jobs = async (jobId: string, filter: string, tab: string) => {
  const job: Job = await DB.Jobs.findById(jobId);

  if (!job)
    return <div className="p-6 text-error font-bold">Job not found</div>;

  let tabFragment;

  switch (tab) {
    case "status":
      tabFragment = Templates.statusFragment(job);
      break;
    case "media":
      // Fetch media data and pass to template
      const events = await DB.Events.findByJobId(jobId);
      const mediaData: {
        images: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        videos: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        audio: Array<{
          filename: string;
          subfolder: string;
          type: string;
          status: string;
        }>;
        pending: Array<{
          mode: string;
          filename: string | null;
          status: string;
        }>;
      } = {
        images: [],
        videos: [],
        audio: [],
        pending: [],
      };

      for (const event of events) {
        if (event.status === "pending") {
          mediaData.pending.push({
            mode: event.mode,
            filename: (event as any).filename ?? null,
            status: event.status,
          });
        } else {
          const meta = await DB.Meta.findByEventId(event.id).catch(() => null);
          if (meta) {
            if (event.mode === "image") {
              mediaData.images.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            } else if (event.mode === "video") {
              mediaData.videos.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            } else if (
              event.mode === "speech" ||
              event.mode === "instrumental"
            ) {
              mediaData.audio.push({
                filename: meta.filename,
                subfolder: meta.subfolder,
                type: meta.type,
                status: event.status,
              });
            }
          }
        }
      }
      tabFragment = Templates.mediaFragment(job, mediaData);
      break;
    case "events":
      tabFragment = Templates.eventsFragment(job);
      break;
    default:
      tabFragment = Templates.statusFragment(job);
  }

  return (
    <div
      id="job-details"
      className="drawer lg:drawer-open min-h-screen bg-base-100"
    >
      <input id="sidebar-toggle" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content">
        {/* Header */}
        <header className="navbar bg-base-200 px-6 shadow-sm fixed top-0 left-0 right-0">
          <div className="flex-1">
            <h1 className="text-xl font-bold">{truncateJobId(jobId)}</h1>
          </div>
          <div className="flex-none lg:hidden">
            <label
              htmlFor="sidebar-toggle"
              className="btn btn-square btn-ghost"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-6 h-6 text-current"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </label>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6 flex-1 overflow-y-auto">
          <div id="job-tabs-container" data-job-id={jobId}>
            {/* Tabs Section - Dedicated section with background and border, snaps to header/sidebar */}
            {tabs(jobId, filter, tab)}
            {/* Content Area */}
            <div id="job-content-area" className="min-h-[500px] py-4">
              {tabFragment}
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <dialog id="delete-confirm-modal" className="modal"></dialog>

      {/* Job List Sidebar */}
      <aside className="drawer-side z-10 max-h-screen bg-base-100 border-r border-base-300 flex flex-col scrollbar-hide">
        <label htmlFor="sidebar-toggle" className="drawer-overlay"></label>
        <div className="scrollbar-hide">{jobSidebar(jobId, filter, tab)}</div>
      </aside>
    </div>
  );
};
