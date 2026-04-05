import { Child } from "hono/jsx";

export const app = (content: Child, jobId?: string, page?: string) => (
  <div className="drawer lg:drawer-open min-h-screen bg-base-100">
    <input id="sidebar-toggle" type="checkbox" className="drawer-toggle" />

    <div className="drawer-content flex flex-col">
      {/* Header */}
      <header className="navbar bg-base-200 px-6 shadow-sm z-10">
        <div className="flex-1">
          <h1 id="header-title" className="text-xl font-bold">
            {page === "dashboard" && "Dashboard"}
            {page === "jobs" && "Jobs"}
            {page === "settings" && "Settings"}
            {page === "job" && "Job"}
            {!page && "Silicon Seeds"}
          </h1>
        </div>
        <div className="flex-none lg:hidden">
          <label htmlFor="sidebar-toggle" className="btn btn-square btn-ghost">
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
      <main className="p-6 flex-1">
        <div id="job-content-container" className="min-h-[400px]">
          {content}
        </div>
      </main>
    </div>

    {/* Delete Confirmation Modal */}
    <dialog id="delete-confirm-modal" class="modal"></dialog>

    {/* Sidebar */}
    <aside className="drawer-side z-20">
      <label htmlFor="sidebar-toggle" className="drawer-overlay"></label>
      <div className="w-64 min-h-full bg-base-200 border-r border-base-300 p-4 flex flex-col">
        {/* Silicon Seeds title at top of sidebar */}
        <a
          href="/"
          hx-get="/"
          hx-target="#job-content-container"
          hx-swap="innerHTML"
          hx-push-url="/"
          className="text-xl font-bold mb-4 px-2 text-primary"
        >
          Silicon Seeds
        </a>

        <ul className="menu menu-md w-full">
          {/* Dashboard */}
          <li>
            <a
              hx-get="/api/dashboard?page=dashboard"
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url="/?page=dashboard"
              id="sidebar-dashboard-link"
              className="w-full"
            >
              <span className="font-bold">Dashboard</span>
            </a>
          </li>

          {/* Divider */}
          <div className="divider my-1"></div>

          {/* Jobs */}
          <li>
            <a
              hx-get="/api/jobs/list-view?page=jobs"
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url="/?page=jobs"
              id="sidebar-jobs-summary"
              className="w-full"
            >
              <span className="font-bold">Jobs</span>
            </a>
          </li>

          {/* Divider */}
          <div className="divider my-1"></div>

          {/* Settings */}
          <li>
            <a
              hx-get="/api/settings/page?page=settings"
              hx-target="#job-content-container"
              hx-swap="innerHTML"
              hx-push-url="/?page=settings"
              id="sidebar-settings-link"
              className="w-full"
            >
              <span className="font-bold">Settings</span>
            </a>
          </li>
        </ul>

        {/* Sidebar footer with theme toggle */}
        <div className="mt-auto pt-4 border-t border-base-300 flex justify-end items-center">
          <label className="swap swap-rotate">
            {/* this hidden checkbox controls the state */}
            <input
              type="checkbox"
              className="theme-controller"
              value="dracula"
            />

            {/* sun icon */}
            <svg
              className="swap-off h-8 w-8 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
            </svg>

            {/* moon icon */}
            <svg
              className="swap-on h-8 w-8 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
            </svg>
          </label>
        </div>
      </div>
    </aside>
  </div>
);
