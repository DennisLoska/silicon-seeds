import { Hono } from "hono";

const app = new Hono();

app.get("/status/:jobId", (c) => {
  return c.html("Status content placeholder");
});

app.get("/media/:jobId", (c) => {
  return c.html("Media content placeholder");
});

app.get("/events/:jobId", (c) => {
  return c.html("Events content placeholder");
});

export default app;
