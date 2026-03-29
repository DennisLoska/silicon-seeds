import { DB } from "../../db/db";
import { Templates } from "../../templates/templates";

export async function detail(c: any) {
  const jobId = c.req.query("jobId");
  
  if (!jobId || jobId === "") {
    return c.html(
      <div class="text-center py-20 text-base-content/70">
        <p>Select a job from the sidebar to view its details</p>
      </div>
    );
  }

  return c.html(Templates.jobDetailFragment(jobId));
}
