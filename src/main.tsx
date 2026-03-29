import { Hono } from "hono";
import { DB } from "./db/db";

const app = new Hono();

// Jobs list endpoint with JSX
app.get("/api/jobs/list", async (c) => {
  const jobs = await DB.db
    .selectFrom("jobs")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();

  return c.html(
    <div>
      {jobs.length === 0 ? (
        <p class="text-base-content/70">No jobs yet</p>
      ) : (
        jobs.map((job) => {
          const date = new Date(job.created_at).toLocaleString();
          return (
            <div key={job.id} class="card bg-base-100 shadow-sm">
              <div class="card-body p-3">
                <div class="text-sm font-bold">{job.id}</div>
                <div class="text-xs text-base-content/70">{date}</div>
              </div>
            </div>
          );
        })
      )}
    </div>,
  );
});

export default app;
