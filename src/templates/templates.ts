import { app as application } from "./app";
import { layout } from "./layout";
import { Status } from "./status";
import { Media } from "./media";
import { Events } from "./events";
import { jobDetailsFragment, jobs, jobTabs } from "./jobs";
import { NotSelected } from "./not-selected";
import { dashboard } from "./dashboard";
import { settings } from "./settings";
import { Job } from "../events/events";
import { OobHeader as header } from "./oob-header";
import { eventsListFragment } from "./events-list";

export namespace Templates {
  export const app = application;
  export const Layout = layout;
  export const StatusFragment = (job: Job) => Status(job);
  export const MediaFragment = (job: Job, mediaData?: any) =>
    Media(job, mediaData);
  export const EventsFragment = (job: Job) => Events(job);
  export const NotSelectedFragment = NotSelected;
  export const JobDetailsFragment = jobDetailsFragment;
  export const JobTabsFragment = jobTabs;
  export const JobsFragment = jobs;
  export const EventList = (jobId: string) => eventsListFragment(jobId);
  export const Dashboard = dashboard();
  export const Settings = settings();
  export const OobHeader = header;
}
