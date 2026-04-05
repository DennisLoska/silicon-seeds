import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  const currentId = c.req.query("current_id");
  const filter = c.req.query("filter");
  
  if (c.req.header("HX-Request")) {
    // HTMX request - return content fragment + OOB header update
    return c.html(
      <>
        {await Templates.jobListFragment(currentId, filter)}
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Jobs</h1>
        </div>
      </>
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(await Templates.jobListFragment(currentId, filter), undefined, "jobs"));
});

export default app;
