import { Templates } from "../../templates/templates";

export async function list_jobs(activeJobId?: string) {
  return await Templates.jobListFragment(activeJobId);
}
