import { DB } from "../../db/db";
import { Templates } from "../../templates/templates";

export async function list() {
  const jobs = await DB.Jobs.list();

  return Templates.jobListFragment(jobs);
}
