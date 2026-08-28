import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import Layout from "./components/Layout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Compose = lazy(() => import("./pages/Compose"));
const AutoCut = lazy(() => import("./pages/AutoCut"));
const CreateImage = lazy(() => import("./pages/CreateImage"));
const CreateAudio = lazy(() => import("./pages/CreateAudio"));
const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:jobId" component={Jobs} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/compose" component={Compose} />
      <Route path="/create/image" component={CreateImage} />
      <Route path="/create/audio" component={CreateAudio} />
      <Route path="/create/autocut" component={AutoCut} />
      <Route path="/create/video" component={CreateImage} />
      <Route path="/create/text" component={CreateImage} />
      <Route path="/settings" component={Settings} />
    </Router>
  );
}
