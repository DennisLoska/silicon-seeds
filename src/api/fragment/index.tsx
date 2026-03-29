import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";
  
  return c.html(
    <div>
      <div class="tabs tabs-box mb-6" role="tablist">
        <button
          class="tab"
          hx-get={`/fragment/${jobId}?tab=status`}
          hx-target="#job-content-area"
          hx-swap="innerHTML"
        >
          Status
        </button>
        <button
          class="tab"
          hx-get={`/fragment/${jobId}?tab=media`}
          hx-target="#job-content-area"
          hx-swap="innerHTML"
        >
          Media
        </button>
        <button
          class="tab"
          hx-get={`/fragment/${jobId}?tab=events`}
          hx-target="#job-content-area"
          hx-swap="innerHTML"
        >
          Events
        </button>
      </div>

      <div id="job-content-area" class="min-h-[400px]">
        {tab === "status" && Templates.statusFragment()}
        {tab === "media" && Templates.mediaFragment()}
        {tab === "events" && Templates.eventsFragment()}
      </div>
    </div>
  );
});

export default app;
