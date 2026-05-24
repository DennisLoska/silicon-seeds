import { Templates } from "./templates";
import { DB } from "../db/db";
import { Job, JobLifecycleStatus } from "../events/events";
import { truncateJobId } from "./utils";
import { Icons } from "./icons";

export interface JobsProps {
  jobId: string;
  filter: string;
  tab: string;
}

export interface JobTabsProps {
  jobId: string;
  filter: string;
  tab: string;
}

export interface JobDetailsProps {
  jobId: string;
  activeTab?: string;
}

const filterMap = {
  all: "All",
  recent: "Recent",
  active: "Active",
  complete: "Complete",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

function getJobStatusUi(status: JobLifecycleStatus | undefined) {
  switch (status) {
    case JobLifecycleStatus.Complete:
      return {
        label: "Complete",
        badge: "badge-success",
        Icon: Icons.StatusCompleteSmall,
      };
    case JobLifecycleStatus.Failed:
      return {
        label: "Failed",
        badge: "badge-error",
        Icon: Icons.StatusFailedSmall,
      };
    case JobLifecycleStatus.Cancelled:
      return {
        label: "Cancelled",
        badge: "badge-neutral",
        Icon: Icons.StatusCancelledSmall,
      };
    default:
      return {
        label: "Active",
        badge: "badge-warning",
        Icon: Icons.StatusPendingSmall,
      };
  }
}

export const JobDetails = async ({ jobId, activeTab }: JobDetailsProps) => {
  const job: Job = await DB.Jobs.findById(jobId);

  if (!job) {
    return <div className="p-6 text-error font-bold">Job not found!</div>;
  }

  const currentTab = activeTab || "status";
  let contentFragment;

  switch (currentTab) {
    case "status":
      contentFragment = Templates.StatusFragment(job);
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
            // Check if it's an image by filename extension first
            const isImageFile = meta.filename?.endsWith(".png");
            if (event.mode === "image" || isImageFile) {
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
      contentFragment = Templates.MediaFragment(mediaData);
      break;
    case "events":
      contentFragment = Templates.EventsFragment(job);
      break;
    default:
      contentFragment = Templates.StatusFragment(job);
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
  } else if (filter === "complete") {
    jobs = jobs.filter((job) => job.status === JobLifecycleStatus.Complete);
  } else if (filter === "active") {
    jobs = jobs.filter((job) => job.status === JobLifecycleStatus.Active);
  } else if (filter === "failed") {
    jobs = jobs.filter((job) => job.status === JobLifecycleStatus.Failed);
  } else if (filter === "cancelled") {
    jobs = jobs.filter((job) => job.status === JobLifecycleStatus.Cancelled);
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
      <div className="sticky top-0 z-10 bg-base-100 flex gap-2 px-4 py-0 pt-4 pb-4 border-b border-base-300">
        <button
          className="btn btn-primary btn-md flex justify-end"
          hx-post="/api/jobs/images"
          hx-trigger="click"
        >
          New Job
          <Icons.NewJobIcon />
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
                  hx-get="/jobs?filter=active"
                  hx-target="#job-details"
                  hx-swap="outerHTML"
                  hx-push-url="/jobs?filter=active"
                >
                  Active
                </a>
              </li>
              <li>
                <a
                  hx-get="/jobs?filter=complete"
                  hx-target="#job-details"
                  hx-swap="outerHTML"
                  hx-push-url="/jobs?filter=complete"
                >
                  Complete
                </a>
              </li>
              <li>
                <a
                  hx-get="/jobs?filter=failed"
                  hx-target="#job-details"
                  hx-swap="outerHTML"
                  hx-push-url="/jobs?filter=failed"
                >
                  Failed
                </a>
              </li>
              <li>
                <a
                  hx-get="/jobs?filter=cancelled"
                  hx-target="#job-details"
                  hx-swap="outerHTML"
                  hx-push-url="/jobs?filter=cancelled"
                >
                  Cancelled
                </a>
              </li>
          </ul>
        </details>
      </div>

      <ul className="list lg:max-w-[420px] w-full">
        {jobs.map((jobItem) => {
          const date = new Date(jobItem.created_at).toLocaleString();
          const isActive = activeJobId === jobItem.id;
          const statusUi = getJobStatusUi(jobItem.status);

          return (
            <li
              key={jobItem.id}
              className={`list-row p-0 flex items-center justify-between rounded-sm shadow-sm hover:shadow-md transition-all ${
                isActive
                  ? "bg-primary text-primary-content"
                  : "hover:bg-base-300"
              }`}
            >
              <div
                className="flex items-center gap-2 cursor-pointer flex-grow-1 w-full h-full px-4 py-3"
                hx-get={`/jobs?job_id=${jobItem.id}&filter=${filter}&tab=status`}
                hx-target="#job-content-container"
                hx-swap="innerHTML"
                hx-push-url={`/jobs?job_id=${jobItem.id}&filter=${filter}&tab=${tab}`}
              >
                <span
                  className={`badge ${statusUi.badge}`}
                  title={statusUi.label}
                >
                  <statusUi.Icon />
                </span>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-sm leading-tight">
                    {jobItem.name}
                  </span>
                  <span
                    className="font-bold text-xs lg:hidden"
                    style={{
                      maxWidth: "8ch",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {truncateJobId(jobItem.id)}
                  </span>
                  <span className="font-bold text-xs hidden lg:inline">
                    {jobItem.id}
                  </span>
                  <span className="text-xs font-medium opacity-80">
                    {statusUi.label}
                  </span>
                  <span className="text-xs opacity-60">{date}</span>
                </div>
              </div>
                <button
                  className="btn btn-ghost btn-sm mr-4"
                  hx-get={`/api/fragments/job-action-modal?jobId=${jobItem.id}&action=delete&source=jobs&filter=${filter}&tab=${tab}`}
                  hx-target="#job-action-modal"
                  hx-swap="outerHTML"
                  title="Delete job"
                >
                  <Icons.DeleteIcon />
                </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const TABS = [
  { value: "status", label: "Status" },
  { value: "media", label: "Media" },
  { value: "events", label: "Events" },
] as const;

export const JobTabs = ({ jobId, filter, tab }: JobTabsProps) => (
  <div className="sticky top-[-1.5rem] z-10 bg-base-100 px-6 py-0 -mt-6 mx-[-1.5rem] border-b border-base-300 shadow-sm">
    <div className="tabs w-full" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.value}
          className={`tab ${
            tab === t.value
              ? "tab-active border-b-2 border-primary font-medium"
              : "hover:bg-base-200"
          }`}
          hx-get={`/jobs/details/${jobId}?tab=${t.value}`}
          hx-target="#job-tabs-container"
          hx-swap="innerHTML"
          hx-push-url={`/jobs?job_id=${jobId}&filter=${filter}&tab=${t.value}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
);

export const Jobs = async ({ jobId, filter, tab }: JobsProps) => {
  const job: Job = await DB.Jobs.findById(jobId);

  if (!job)
    return <div className="p-6 text-error font-bold">Job not found</div>;

  let tabFragment;

  switch (tab) {
    case "status":
      tabFragment = Templates.StatusFragment(job);
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
            // Check if it's an image by filename extension first
            const isImageFile = meta.filename?.endsWith(".png");
            if (event.mode === "image" || isImageFile) {
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
      tabFragment = Templates.MediaFragment(mediaData);
      break;
    case "events":
      tabFragment = Templates.EventsFragment(job);
      break;
    default:
      tabFragment = Templates.StatusFragment(job);
  }

  return (
    <div
      id="job-details"
      className="drawer lg:drawer-open h-[95vh] overflow-y-hidden bg-base-100"
    >
      <input id="jobs-drawer" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content">
        {/* Header */}
        <header className="navbar bg-base-200 px-6 shadow-sm fixed top-0 left-0 right-0">
          <div className="flex-1">
            <h1 className="text-xl font-bold">{truncateJobId(jobId)}</h1>
          </div>
          <div className="flex-none lg:hidden">
            <label
              htmlFor="jobs-drawer"
              className="btn btn-square btn-ghost"
            ></label>
          </div>
        </header>

        {/* Main Content Area */}
        <main
          className="p-6 flex-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          <div id="job-tabs-container" data-job-id={jobId}>
            {/* Tabs Section - Dedicated section with background and border, snaps to header/sidebar */}
            <JobTabs jobId={jobId} filter={filter} tab={tab} />
            {/* Content Area */}
            <div id="job-content-area" className="min-h-[500px] py-4">
              {tabFragment}
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <dialog id="job-action-modal" className="modal"></dialog>

      {/* Floating Action Button for Job List (mobile only) */}
      <label
        htmlFor="jobs-drawer"
        className="fixed bottom-6 right-6 btn btn-circle btn-primary shadow-lg lg:hidden z-50"
        aria-label="Open job list"
      >
        <Icons.BurgerIcon />
      </label>

      {/* Job List Sidebar */}
      <aside className="drawer-side z-10 max-h-screen bg-base-100 border-r border-base-300 flex flex-col scrollbar-hide w-full lg:w-auto">
        <label htmlFor="jobs-drawer" className="drawer-overlay"></label>
        <div className="scrollbar-hide w-full lg:w-auto">
          {jobSidebar(jobId, filter, tab)}
        </div>
      </aside>
    </div>
  );
};
