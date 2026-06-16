import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Player,
  PlayerControls,
  usePlayerStore,
  useTimelinePlayer,
} from "@hyperframes/studio";
import { sendReady, sendCompositionLoaded, sendWaiting, sendError, onParentMessage } from "./bridge";

const POLL_INTERVAL = 3000;

function useUrlParam(name: string): string | null {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }, []);
}

function Controls() {
  const player = useTimelinePlayer();
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <PlayerControls
      onTogglePlay={() => (isPlaying ? player.pause() : player.play())}
      onSeek={(time) => player.seek(time)}
    />
  );
}

function useCompositionLoader(jobId: string | null) {
  const [compUrl, setCompUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "loaded" | "error">("loading");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchComposition = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch(`/api/composition/${jobId}`);
    if (res.ok) {
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setCompUrl(url);
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
    setCompUrl(null);

    fetchComposition().then((loaded) => {
      if (!loaded) {
        setStatus("waiting");
        sendWaiting("Composition not ready. Retrying...");
        pollRef.current = setInterval(async () => {
          const ok = await fetchComposition();
          if (ok && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }, POLL_INTERVAL);
      }
    });

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, fetchComposition]);

  return { compUrl, status, fetchComposition };
}

export function App() {
  const jobId = useUrlParam("job_id");
  const [ready, setReady] = useState(false);
  const { compUrl, status, fetchComposition } = useCompositionLoader(jobId);

  useEffect(() => {
    sendReady();
  }, []);

  const handleReload = useCallback(() => {
    fetchComposition();
  }, [fetchComposition]);

  useEffect(() => {
    return onParentMessage((msg) => {
      if (msg.type === "hypercut-reload-composition") {
        handleReload();
      }
    });
  }, [handleReload]);

  if (!jobId) {
    return <div style={{ padding: 16 }}>Missing job_id parameter</div>;
  }

  if (status === "loading" || status === "waiting") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: "2px solid rgba(255,255,255,0.1)",
              borderTopColor: "#a6e3a1",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            {status === "waiting"
              ? "Processing job, waiting for composition..."
              : "Loading composition..."}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error" && !compUrl) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Failed to load composition.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ flex: 1, position: "relative" }}>
        <Player directUrl={compUrl!} onLoad={() => setReady(true)} />
      </div>
      {ready && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <Controls />
        </div>
      )}
    </div>
  );
}
