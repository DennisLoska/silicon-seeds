import { Hono } from "hono";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";

const app = new Hono();

app.get("/status", (c) => status());
app.get("/media", (c) => media());
app.get("/events", (c) => events());

export default app;
