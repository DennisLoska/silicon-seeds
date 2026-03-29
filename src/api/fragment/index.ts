import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/status/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  return c.render(Templates.statusFragment());
});

app.get("/media/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  return c.render(Templates.mediaFragment());
});

app.get("/events/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  return c.render(Templates.eventsFragment());
});

export default app;
