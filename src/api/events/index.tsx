import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.html(
      <div class="p-6 text-center text-base-content/60">No job selected.</div>,
    );
  }

  const EventList = await Templates.eventList(jobId);
  return c.html(EventList);
});

export default app;
