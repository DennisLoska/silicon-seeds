import { DB } from "../../db/db";

export async function delete_job(jobId: string) {
  await DB.Jobs.deleteById(jobId);
  
  const response = new Response(JSON.stringify({ message: "job deleted" }), {
    status: 200,
  });
  response.headers.set("HX-Refresh", "true");
  return response;
}
