import { DB } from "../../db/db";
import { Templates } from "../../templates/templates";

export async function detail(c: any) {
  const jobId = c.req.query("jobId");
  
  if (!jobId) {
    return new Response("No job selected", { status: 400 });
  }

  return new Response(Templates.jobDetailFragment(jobId), {
    headers: { "Content-Type": "text/html" },
  });
}
