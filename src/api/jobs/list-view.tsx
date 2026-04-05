import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  const page = c.req.query("page") || "jobs";
  
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        {/* Main content: list of all jobs */}
        {await Templates.jobListFragment()}
        
        {/* OOB swap for Dashboard link - set active based on current page */}
        <div id="sidebar-dashboard-link" hx-swap-oob="true">
          <a
            hx-get="/api/dashboard"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            class={page === "dashboard" ? "active bg-primary text-primary-content" : ""}
          >
            📊 Dashboard
          </a>
        </div>
        
        {/* OOB swap for Jobs summary - set active based on current page */}
        <div id="sidebar-jobs-summary" hx-swap-oob="true">
          <summary
            id="sidebar-jobs-summary"
            class={`font-bold flex items-center gap-2 cursor-pointer ${page === "jobs" ? "active bg-primary text-primary-content" : ""}`}
            hx-get="/api/jobs/list-view"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
          >
            📁 Jobs
          </summary>
        </div>
        
        {/* OOB swap for Settings link - set active based on current page */}
        <div id="sidebar-settings-link" hx-swap-oob="true">
          <a
            hx-get="/api/settings/page"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            class={page === "settings" ? "active bg-primary text-primary-content" : ""}
          >
            ⚙️ Settings
          </a>
        </div>
      </>,
    );
  }

  // Return the complete page with the correct active tab
  return c.html(Templates.jobListFragment());
});

export default app;
