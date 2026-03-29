import { Templates } from "./templates";

export const jobDetail = (jobId: string) => (
  <div id="job-tabs-container" data-job-id={jobId}>
    <div class="tabs tabs-box mb-6" role="tablist">
      <button
        class="tab tab-active"
        onclick="switchTab('status', this)"
        hx-get="/static/placeholder.js"
        hx-swap="none"
      >
        Status
      </button>
      <button
        class="tab"
        onclick="switchTab('media', this)"
        hx-get="/static/placeholder.js"
        hx-swap="none"
      >
        Media
      </button>
      <button
        class="tab"
        onclick="switchTab('events', this)"
        hx-get="/static/placeholder.js"
        hx-swap="none"
      >
        Events
      </button>
    </div>

    <div id="job-content-area" class="min-h-[400px]">
      <div id="tab-status">{Templates.statusFragment()}</div>
      <div id="tab-media" class="hidden">{Templates.mediaFragment()}</div>
      <div id="tab-events" class="hidden">{Templates.eventsFragment()}</div>
    </div>
  </div>
);
