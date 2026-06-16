import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { NLELayout } from "@hyperframes/studio";
import { TimelineEditProvider } from "../../node_modules/@hyperframes/studio/src/contexts/TimelineEditContext";
import { FileManagerProvider } from "../../node_modules/@hyperframes/studio/src/contexts/FileManagerContext";
import { sendReady, sendCompositionLoaded, sendWaiting, sendError, onParentMessage } from "./bridge";

const POLL_INTERVAL = 3000;

function useUrlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
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

function useStubFileManager(jobId: string | null) {
  return useMemo(() => {
    const noop = () => {};
    const asyncNoop = async () => {};
    const projectIdRef = { current: jobId };
    const editingPathRef = { current: null as string | null };
    const saveRafRef = { current: null as ReturnType<typeof setTimeout> | null };
    const importedFontAssetsRef = { current: [] as unknown[] };

    return {
      editingFile: null,
      setEditingFile: noop as any,
      projectDir: "",
      fileTree: [] as string[],
      fileTreeLoaded: false,
      setFileTree: noop as any,
      editingPathRef,
      projectIdRef,
      saveRafRef,
      importedFontAssetsRef,
      readProjectFile: async (_path: string) => "",
      writeProjectFile: async (_path: string, _content: string) => {},
      readOptionalProjectFile: async (_path: string) => null,
      updateEditingFileContent: noop as any,
      revealSourceOffset: null as number | null,
      openSourceForSelection: noop as any,
      handleFileSelect: noop as any,
      handleContentChange: noop as any,
      refreshFileTree: noop as any,
      uploadProjectFiles: asyncNoop as any,
      handleCreateFile: noop as any,
      handleCreateFolder: noop as any,
      handleDeleteFile: noop as any,
      handleRenameFile: noop as any,
      handleDuplicateFile: noop as any,
      handleMoveFile: noop as any,
      handleImportFiles: asyncNoop as any,
      handleImportFonts: asyncNoop as any,
      compositions: [] as string[],
      assets: [] as string[],
      fontAssets: [] as any[],
    } as any;
  }, [jobId]);
}

export function App() {
  const jobId = useUrlParam("job_id");
  const status = useCompositionLoader(jobId);
  const fileManager = useStubFileManager(jobId);

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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

  return (
    <FileManagerProvider value={fileManager}>
      <TimelineEditProvider value={{}}>
        <NLELayout projectId={jobId} />
      </TimelineEditProvider>
    </FileManagerProvider>
  );
}
