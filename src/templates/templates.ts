import { app as application } from "./app";
import { layout } from "./layout";
import { jobList } from "./job-list";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";
import { jobDetail } from "./job-detail";
import { notSelected } from "./not-selected";
import { Job } from "../events/events";

export namespace Templates {
  export const app = application;
  export const layoutPage = layout;
  export const jobListFragment = (jobs: Job[], activeJobId?: string) => jobList(jobs, activeJobId);
  export const statusFragment = (job: Job, activeTab?: string) => status(job, activeTab);
  export const mediaFragment = (job: Job, activeTab?: string) => media(job, activeTab);
  export const eventsFragment = (job: Job, activeTab?: string) => events(job, activeTab);
  export const jobDetailFragment = jobDetail;
  export const notSelectedFragment = notSelected;
}
