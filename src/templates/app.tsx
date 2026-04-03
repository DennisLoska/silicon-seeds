import { Child } from "hono/jsx";

export const app = (content: Child) => (
  <div class="drawer lg:drawer-open min-h-screen bg-base-100">
    <input id="sidebar-toggle" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col">
      {/* Header */}
      <header class="navbar bg-base-200 px-6 shadow-sm z-10">
        <div class="flex-none lg:hidden">
          <label htmlFor="sidebar-toggle" class="btn btn-square btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="inline-block w-6 h-6 text-current"
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
        <div class="navbar-start">
          <div class="text-lg font-bold">Silicon Seeds</div>
        </div>
        <div class="navbar-end">
          <button
            class="btn btn-square"
            hx-get="/api/settings"
            hx-target="#settings-content"
            hx-swap="innerHTML"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main class="p-6 flex-1">
        <div id="job-content-container" class="min-h-[400px]">
          {content}
        </div>
      </main>
    </div>

    {/* Sidebar */}
    <aside class="drawer-side z-20">
      <label htmlFor="sidebar-toggle" class="drawer-overlay"></label>
      <div class="w-64 min-h-full bg-base-200 border-r border-base-300 p-4 flex flex-col">
        <h2 class="text-xl font-bold mb-4 px-2 text-primary">Jobs</h2>
        <div
          id="job-list"
          hx-get="/api/jobs/list"
          hx-trigger="load"
          hx-swap="innerHTML"
          aria-live="polite"
          class="overflow-y-auto"
        ></div>
      </div>
    </aside>

    {/* Settings Overlay/Content */}
    <div id="settings-content"></div>
  </div>
);
