import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";

  if (tab === "status") {
    return c.html(await Templates.statusFragment());
  } else if (tab === "media") {
    return c.html(await Templates.mediaFragment());
  } else if (tab === "events") {
    return c.html(await Templates.eventsFragment());
  }

  return c.text("Invalid tab", 400);
});

export default app;
