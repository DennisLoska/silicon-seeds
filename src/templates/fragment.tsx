import { Hono } from "hono";
import { status } from "../api/fragment/status";
import { media } from "../api/fragment/media";
import { events } from "../api/fragment/events";

const app = new Hono();

app.get("/status", (c) => status());
app.get("/media", (c) => media());
app.get("/events", (c) => events());

export default app;
