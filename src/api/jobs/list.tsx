import { Templates } from "../../templates/templates";

export async function list_jobs(activeJobId?: string) {
  return <div id="sidebar">{await Templates.jobListFragment(activeJobId)}</div>;
}
