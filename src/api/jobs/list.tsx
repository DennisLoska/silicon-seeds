import { DB } from "../../db/db";
import { Templates } from "../../templates/templates";

export async function list(activeJobId?: string) {
  const jobs = await DB.Jobs.list();

  return Templates.jobListFragment(jobs, activeJobId);
}
