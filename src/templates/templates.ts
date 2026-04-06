import { app as application } from "./app";
import { layout } from "./layout";
import { status } from "./status";
import { media } from "./media";
import { events } from "./events";
import { jobs } from "./jobs";
import { notSelected } from "./not-selected";
import { dashboard } from "./dashboard";
import { settings } from "./settings";
import { Job } from "../events/events";

export namespace Templates {
  export const app = application;
  export const layoutPage = layout;
  export const statusFragment = (job: Job) => status(job);
  export const mediaFragment = (job: Job, mediaData?: any) =>
    media(job, mediaData);
  export const eventsFragment = (job: Job) => events(job);
  export const notSelectedFragment = notSelected;
  export const jobsFragment = jobs;
  export const dashboardFragment = dashboard;
  export const settingsFragment = settings;
}
