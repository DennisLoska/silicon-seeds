export const jobDetail = (jobId: string) => (
  <div id="job-tabs-container" data-job-id={jobId}>
    <div class="tabs tabs-box mb-6" role="tablist">
      <button
        class="tab tab-active"
        hx-get={`/fragment/status/${jobId}`}
        hx-target="#job-content-area"
        hx-swap="innerHTML"
      >
        Status
      </button>
      <button
        class="tab"
        hx-get={`/fragment/media/${jobId}`}
        hx-target="#job-content-area"
        hx-swap="innerHTML"
      >
        Media
      </button>
      <button
        class="tab"
        hx-get={`/fragment/events/${jobId}`}
        hx-target="#job-content-area"
        hx-swap="innerHTML"
      >
        Events
      </button>
    </div>

    <div id="job-content-area" class="min-h-[400px]">
      <div class="text-center py-20 text-base-content/70">
        <p>Select a tab to view details</p>
      </div>
    </div>
  </div>
);
