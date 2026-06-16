import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Player,
  PlayerControls,
  Timeline,
  usePlayerStore,
  useTimelinePlayer,
} from "@hyperframes/studio";
import { sendReady, sendCompositionLoaded, sendError, onParentMessage } from "./bridge";

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
    <>
      <PlayerControls
        onTogglePlay={() => (isPlaying ? player.pause() : player.play())}
        onSeek={(time) => player.seek(time)}
      />
      <div style={{ height: 192, overflowY: "auto" }}>
        <Timeline />
      </div>
    </>
  );
}

export function App() {
  const jobId = useUrlParam("job_id");
  const [compUrl, setCompUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    sendReady();
  }, []);

  useEffect(() => {
    if (!jobId) {
      sendError("Missing job_id parameter");
      return;
    }

    fetch(`/api/composition/${jobId}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(`Failed to load composition: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setCompUrl(url);
        sendCompositionLoaded(jobId);
      })
      .catch((err) => {
        sendError(err.message);
      });
  }, [jobId]);

  const handleReload = useCallback(() => {
    if (!jobId) return;
    const oldUrl = compUrl;
    fetch(`/api/composition/${jobId}`)
      .then((res) => res.text())
      .then((html) => {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setCompUrl(url);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        sendCompositionLoaded(jobId);
      })
      .catch((err) => sendError(err.message));
  }, [jobId, compUrl]);

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

  if (!compUrl) {
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
          <p style={{ fontSize: 14, opacity: 0.7 }}>
            Loading composition...
          </p>
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
      <div style={{ flex: 1, position: "relative" }}>
        <Player directUrl={compUrl} onLoad={() => setReady(true)} />
      </div>
      {ready && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <Controls />
        </div>
      )}
    </div>
  );
}
