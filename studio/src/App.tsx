import { useCallback, useEffect, useRef } from "react";
import {
  NLELayout,
  useTimelinePlayer,
} from "@hyperframes/studio";
import { sendReady, sendCompositionLoaded, sendWaiting, sendError, onParentMessage } from "./bridge";

const POLL_INTERVAL = 3000;

function useUrlParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function useCompositionLoader(jobId: string | null) {
  const [status, setStatus] = useState<"loading" | "waiting" | "loaded" | "error">("loading");

  const checkComposition = useCallback(async () => {
    if (!jobId) return false;
    const res = await fetch(`/api/composition/${jobId}`, { method: "HEAD" });
    if (res.ok) {
      setStatus("loaded");
      sendCompositionLoaded(jobId);
      return true;
    }
    return false;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setStatus("error");
      sendError("Missing job_id parameter");
      return;
    }

    setStatus("loading");

    checkComposition().then((loaded) => {
      if (!loaded) {
        setStatus("waiting");
        sendWaiting("Composition not ready. Retrying...");
        const id = setInterval(async () => {
          const ok = await checkComposition();
          if (ok) clearInterval(id);
        }, POLL_INTERVAL);
      }
    });
  }, [jobId, checkComposition]);

  return status;
}

import { useState } from "react";

export function App() {
  const jobId = useUrlParam("job_id");
  const status = useCompositionLoader(jobId);

  useEffect(() => {
    sendReady();
  }, []);

  useEffect(() => {
    return onParentMessage((msg) => {
      if (msg.type === "hypercut-reload-composition") {
        window.location.reload();
      }
    });
  }, []);

  if (!jobId) {
    return <div style={{ padding: 16, color: "#cdd6f4" }}>Missing job_id parameter</div>;
  }

  if (status === "loading" || status === "waiting") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#a6e3a1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, opacity: 0.7, color: "#cdd6f4" }}>
            {status === "waiting" ? "Processing job, waiting for composition..." : "Loading composition..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <div style={{ padding: 16, color: "#cdd6f4" }}>Failed to load composition.</div>;
  }

  return <NLELayout projectId={jobId} />;
}
