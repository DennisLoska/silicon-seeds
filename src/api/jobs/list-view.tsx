import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  const currentId = c.req.query("current_id");
  
  if (c.req.header("HX-Request")) {
    // HTMX request - return only the content fragment
    return c.html(await Templates.jobListFragment(currentId));
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(await Templates.jobListFragment(currentId), undefined, "jobs"));
});

export default app;
