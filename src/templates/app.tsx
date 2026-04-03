import { Child } from "hono/jsx";

export const app = (content: Child) => (
  <div class="min-h-screen bg-base-100">
    <header class="navbar bg-base-200 px-6">
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

    <main class="flex min-h-[calc(100vh-4rem)] px-6">
      <aside class="w-64 bg-base-200 rounded-box mr-8 p-4">
        <h2 class="text-lg font-bold mb-4">Jobs</h2>
        <div
          id="job-list"
          hx-get="/api/jobs/list"
          hx-trigger="load"
          hx-swap="innerHTML"
          aria-live="polite"
        >
          <span class="loading loading-spinner"></span>
        </div>
      </aside>

      <section class="flex-1">{content}</section>
    </main>

    <div id="settings-content"></div>
  </div>
);
