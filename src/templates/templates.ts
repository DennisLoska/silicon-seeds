import { app as application } from "./app";
import { layout } from "./layout";
import { jobList } from "./job-list";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";
import { jobDetail } from "./job-detail";
import { notSelected } from "./not-selected";
import { dashboard } from "./dashboard";
import { settings as settingsPage } from "./settings";
import { Job } from "../events/events";

export namespace Templates {
  export const app = application;
  export const layoutPage = layout;
  export const jobListFragment = (activeJobId?: string, filter?: string) => jobList(activeJobId, filter);
  export const statusFragment = (job: Job) => status(job);
  export const mediaFragment = (job: Job) => media(job);
  export const eventsFragment = (job: Job) => events(job);
  export const jobDetailFragment = jobDetail;
  export const notSelectedFragment = notSelected;
  export const dashboardFragment = () => dashboard();
  export const settingsFragment = () => settingsPage();
}
