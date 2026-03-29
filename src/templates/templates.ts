import { jobList } from "./job-list";
import { layout } from "./layout";
import { main } from "./main-page";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";
import { jobDetail } from "./job-detail";

export namespace Templates {
  export const layoutPage = layout;
  export const mainPage = main;
  export const jobListFragment = jobList;
  export const statusFragment = status;
  export const mediaFragment = media;
  export const eventsFragment = events;
  export const jobDetailFragment = jobDetail;
}
