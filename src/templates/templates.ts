import { App as appComponent } from "./app";
import { Layout as layoutComponent } from "./layout";
import { Status } from "./status";
import { Media } from "./media";
import { Events } from "./events";
import { NotSelected } from "./not-selected";
import { Dashboard as dashboardComponent } from "./dashboard";
import { Compose as composeComponent } from "./compose";
import { Settings as settingsComponent } from "./settings";
import { Gallery as galleryComponent } from "./gallery";
import { DistinctImage as distinctImageComponent } from "./distinct-image";
import { Job } from "../events/events";
import { OobHeader as oobHeaderComponent } from "./oob-header";
import { EventList } from "./events-list";
import { JobDetails, Jobs, JobTabs } from "./jobs";
import { GeneratedImages as generatedImagesComponent } from "./generated-images";

export namespace Templates {
  export const App = appComponent;
  export const Layout = layoutComponent;
  export const StatusFragment = (job: Job) => Status(job);
  export const MediaFragment = (mediaData: any) => Media(mediaData);
  export const EventsFragment = (job: Job) => Events(job);
  export const NotSelectedFragment = NotSelected;
  export const JobDetailsFragment = JobDetails;
  export const JobTabsFragment = JobTabs;
  export const JobsFragment = Jobs;
  export const EventListFragment = EventList;
  export const GeneratedImagesFragment = generatedImagesComponent;
  export const Dashboard = dashboardComponent;
  export const Settings = settingsComponent;
  export const Compose = composeComponent;
  export const Gallery = galleryComponent;
  export const DistinctImage = distinctImageComponent;
  export const OobHeader = oobHeaderComponent;
}
