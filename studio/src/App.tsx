import { useEffect, useCallback, useMemo, useState } from "react";
import { NLELayout } from "@hyperframes/studio";
import { TimelineEditProvider } from "../../node_modules/@hyperframes/studio/src/contexts/TimelineEditContext";
import { FileManagerProvider } from "../../node_modules/@hyperframes/studio/src/contexts/FileManagerContext";
import { sendReady, sendCompositionLoaded, sendWaiting, sendError, onParentMessage } from "./bridge";

const POLL_INTERVAL = 3000;

function useUrlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function useStubFileManager(jobId: string | null) {
  return useMemo(() => {
    const noop = () => {};
    const asyncNoop = async () => {};
    return {
      editingFile: null, setEditingFile: noop as any,
      projectDir: "", fileTree: [] as string[], fileTreeLoaded: false,
      setFileTree: noop as any,
      editingPathRef: { current: null as string | null },
      projectIdRef: { current: jobId },
      saveRafRef: { current: null as ReturnType<typeof setTimeout> | null },
      importedFontAssetsRef: { current: [] as any[] },
      readProjectFile: async (_p: string) => "",
      writeProjectFile: async (_p: string, _c: string) => {},
      readOptionalProjectFile: async (_p: string) => null,
      updateEditingFileContent: noop as any,
      revealSourceOffset: null as number | null,
      openSourceForSelection: noop as any,
      handleFileSelect: noop as any, handleContentChange: noop as any,
      refreshFileTree: noop as any, uploadProjectFiles: asyncNoop as any,
      handleCreateFile: noop as any, handleCreateFolder: noop as any,
      handleDeleteFile: noop as any, handleRenameFile: noop as any,
      handleDuplicateFile: noop as any, handleMoveFile: noop as any,
      handleImportFiles: asyncNoop as any, handleImportFonts: asyncNoop as any,
      compositions: [] as string[], assets: [] as string[], fontAssets: [] as any[],
    } as any;
  }, [jobId]);
}

export function App() {
  const jobId = useUrlParam("job_id");
  const [status, setStatus] = useState<"loading" | "waiting" | "loaded" | "error">("loading");
  const fileManager = useStubFileManager(jobId);

  useEffect(() => { sendReady(); }, []);
  useEffect(() => onParentMessage((msg) => { if (msg.type === "hypercut-reload-composition") window.location.reload(); }), []);

  useEffect(() => {
    if (!jobId) { setStatus("error"); sendError("Missing job_id parameter"); return; }
    setStatus("loading");
    const check = async () => {
      const res = await fetch(`/api/composition/${jobId}`, { method: "HEAD" });
      if (res.ok) { setStatus("loaded"); sendCompositionLoaded(jobId); return true; }
      return false;
    };
    check().then((loaded) => {
      if (!loaded) {
        setStatus("waiting");
        sendWaiting("Composition not ready...");
        const id = setInterval(async () => { if (await check()) clearInterval(id); }, POLL_INTERVAL);
      }
    });
  }, [jobId]);

  if (!jobId) return <div style={{ padding: 16, color: "#cdd6f4" }}>Missing job_id</div>;
  if (status === "loading" || status === "waiting")
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#a6e3a1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: 14, opacity: 0.7, color: "#cdd6f4" }}>{status === "waiting" ? "Processing..." : "Loading..."}</p>
      </div>
    </div>;
  if (status === "error") return <div style={{ padding: 16, color: "#cdd6f4" }}>Failed to load.</div>;

  return (
    <FileManagerProvider value={fileManager}>
      <TimelineEditProvider value={{}}>
        <NLELayout projectId={jobId} />
      </TimelineEditProvider>
    </FileManagerProvider>
  );
}
