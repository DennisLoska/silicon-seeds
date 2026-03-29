import { DB } from "../../db/db";

export async function list() {
  const jobs = await DB.db
    .selectFrom("jobs")
    .selectAll()
    .orderBy("created_at", "desc")
    .execute();

  let html = "";
  if (jobs.length === 0) {
    html = "<p class='text-base-content/70'>No jobs yet</p>";
  } else {
    jobs.forEach((job) => {
      const date = new Date(job.created_at).toLocaleString();
      html += `
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-3">
            <div class="text-sm font-bold">${job.id}</div>
            <div class="text-xs text-base-content/70">${date}</div>
          </div>
        </div>
      `;
    });
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
