import { Hono } from "hono";
import { eventsListFragment } from "../../templates/events-list";

const app = new Hono();

app.get("/", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.html(
      <div class="p-6 text-center text-base-content/60">
        No job selected.
      </div>,
    );
  }
  const fragment = await eventsListFragment(jobId);
  return c.html(fragment);
});

export default app;
