import { App as appComponent } from "./app";
import { Layout as layoutComponent } from "./layout";
import { Status } from "./status";
import { Media, MediaData } from "./media";
import { Events } from "./events";
import { NotSelected } from "./not-selected";
import { Dashboard as dashboardComponent } from "./dashboard";
import {
  Compose as composeComponent,
  ComposeActionCardFragment as composeActionCardFragment,
  ComposeProgressFragment as composeProgressFragment,
} from "./compose";
import { Settings as settingsComponent } from "./settings";
import { Gallery as galleryComponent } from "./gallery";
import {
  DistinctImage as distinctImageComponent,
  DistinctImageActionCardFragment as distinctImageActionCardFragment,
  DistinctImageGeneratedImagesFragment as distinctImageGeneratedImagesFragment,
  DistinctImageProgressFragment as distinctImageProgressFragment,
} from "./distinct-image";
import {
  DistinctAudio as distinctAudioComponent,
  DistinctAudioActionCardFragment as distinctAudioActionCardFragment,
  DistinctAudioGeneratedAudioFragment as distinctAudioGeneratedAudioFragment,
  DistinctAudioProgressFragment as distinctAudioProgressFragment,
} from "./distinct-audio";
import {
  AutoCut as autoCutComponent,
  AutoCutStatusFragment as autoCutStatusFragment,
} from "./autocut";
import { Job } from "../events/events";
import { OobHeader as oobHeaderComponent } from "./oob-header";
import { EventList } from "./events-list";
import { JobContentArea, JobDetails, Jobs, JobTabs } from "./jobs";
import { GeneratedImages as generatedImagesComponent } from "./generated-images";

export namespace Templates {
  export const App = appComponent;
  export const Layout = layoutComponent;
  export const StatusFragment = (job: Job) => Status(job);
  export const MediaFragment = (mediaData: MediaData) => Media(mediaData);
  export const EventsFragment = (job: Job) => Events(job);
  export const NotSelectedFragment = NotSelected;
  export const JobDetailsFragment = JobDetails;
  export const JobContentAreaFragment = JobContentArea;
  export const JobTabsFragment = JobTabs;
  export const JobsFragment = Jobs;
  export const EventListFragment = EventList;
  export const GeneratedImagesFragment = generatedImagesComponent;
  export const Dashboard = dashboardComponent;
  export const Settings = settingsComponent;
  export const Compose = composeComponent;
  export const ComposeActionCardFragment = composeActionCardFragment;
  export const ComposeProgressFragment = composeProgressFragment;
  export const Gallery = galleryComponent;
  export const DistinctImage = distinctImageComponent;
  export const DistinctImageActionCardFragment = distinctImageActionCardFragment;
  export const DistinctImageProgressFragment = distinctImageProgressFragment;
  export const DistinctImageGeneratedImagesFragment =
    distinctImageGeneratedImagesFragment;
  export const DistinctAudio = distinctAudioComponent;
  export const DistinctAudioActionCardFragment = distinctAudioActionCardFragment;
  export const DistinctAudioProgressFragment = distinctAudioProgressFragment;
  export const DistinctAudioGeneratedAudioFragment =
    distinctAudioGeneratedAudioFragment;
  export const AutoCut = autoCutComponent;
  export const AutoCutStatusFragment = autoCutStatusFragment;
  export const OobHeader = oobHeaderComponent;
}
