import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return only the content fragment
    return c.html(await Templates.jobListFragment());
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(await Templates.jobListFragment(), undefined, "jobs"));
});

export default app;
