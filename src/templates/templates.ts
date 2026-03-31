import { app as application } from "./app";
import { layout } from "./layout";
import { jobList } from "./job-list";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";
import { jobDetail } from "./job-detail";

export namespace Templates {
  export const app = application;
  export const layoutPage = layout;
  export const jobListFragment = jobList;
  export const statusFragment = status;
  export const mediaFragment = media;
  export const eventsFragment = events;
  export const jobDetailFragment = jobDetail;
}
