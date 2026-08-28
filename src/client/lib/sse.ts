import { createEffect, onCleanup } from "solid-js";

export function sseUrl(jobId: string) {
  return `/jobs/stream?job_id=${encodeURIComponent(jobId)}`;
}

export function useJobUpdates(jobId: () => string | null | undefined, onUpdate: () => void) {
  let es: EventSource | null = null;
  let reconnectTimer: number | null = null;
  let onUpdateRef = onUpdate;

  const cleanup = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (es) {
      es.removeEventListener("job-update", onUpdateRef);
      es.close();
      es = null;
    }
  };

  const scheduleReconnect = () => {
    reconnectTimer = window.setTimeout(() => {
      const curId = jobId();
      if (!curId) return;
      if (es) return; // already connected
      onUpdateRef();
      es = new EventSource(sseUrl(curId));
      const h = () => onUpdateRef();
      es.addEventListener("job-update", h);
      (es as unknown as { _h: typeof h })._h = h;
      es.onerror = onError;
    }, 2000);
  };

  const onError = () => {
    const failed = es;
    if (failed) {
      const h = (failed as unknown as { _h?: () => void })._h;
      if (h) failed.removeEventListener("job-update", h);
      failed.close();
      if (es === failed) es = null;
    }
    onUpdateRef();
    scheduleReconnect();
  };

  createEffect(() => {
    const id = jobId();
    cleanup();
    if (!id) return;
    onUpdateRef = onUpdate;
    es = new EventSource(sseUrl(id));
    const handler = () => onUpdateRef();
    es.addEventListener("job-update", handler);
    (es as unknown as { _h: typeof handler })._h = handler;
    es.onerror = onError;
  });

  onCleanup(cleanup);
}
