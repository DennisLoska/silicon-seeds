import { Router, Route } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
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
      <Route
        path="/"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Dashboard />
          </Suspense>
        )}
      />
      <Route
        path="/dashboard"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Dashboard />
          </Suspense>
        )}
      />
      <Route
        path="/jobs"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Jobs />
          </Suspense>
        )}
      />
      <Route
        path="/jobs/:jobId"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Jobs />
          </Suspense>
        )}
      />
      <Route
        path="/gallery"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Gallery />
          </Suspense>
        )}
      />
      <Route
        path="/compose"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Compose />
          </Suspense>
        )}
      />
      <Route
        path="/create/image"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <CreateImage />
          </Suspense>
        )}
      />
      <Route
        path="/create/audio"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <CreateAudio />
          </Suspense>
        )}
      />
      <Route
        path="/create/autocut"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <AutoCut />
          </Suspense>
        )}
      />
      <Route
        path="/create/video"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <CreateImage />
          </Suspense>
        )}
      />
      <Route
        path="/create/text"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <CreateImage />
          </Suspense>
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
            <Settings />
          </Suspense>
        )}
      />
    </Router>
  );
}
