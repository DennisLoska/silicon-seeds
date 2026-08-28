import { createEffect, onCleanup } from "solid-js";

export function sseUrl(jobId: string) {
  return `/jobs/stream?job_id=${encodeURIComponent(jobId)}`;
}

export function useJobUpdates(jobId: () => string | null | undefined, onUpdate: () => void) {
  let es: EventSource | null = null;
  let onUpdateRef = onUpdate;
  onUpdateRef = onUpdate;
  let reconnectTimer: number | null = null;

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

  createEffect(() => {
    const id = jobId();
    cleanup();
    if (!id) return;
    onUpdateRef = onUpdate;
    es = new EventSource(sseUrl(id));
    const handler = () => onUpdateRef();
    es.addEventListener("job-update", handler);
    // store for removal
    (es as unknown as { _handler: typeof handler })._handler = handler;
    es.onerror = () => {
      // close and schedule reconnect via onUpdate + recreate ES
      const failedEs = es;
      if (failedEs) {
        const h = (failedEs as unknown as { _handler?: typeof handler })._handler;
        if (h) failedEs.removeEventListener("job-update", h);
        failedEs.close();
        if (es === failedEs) es = null;
      }
      // trigger data refetch then recreate connection after delay
      onUpdateRef();
      reconnectTimer = window.setTimeout(() => {
        const curId = jobId();
        if (!curId) return;
        // force effect re-run by closing stale ref — recreate here
        if (!es) {
          es = new EventSource(sseUrl(curId));
          const nh = () => onUpdateRef();
          es.addEventListener("job-update", nh);
          (es as unknown as { _handler: typeof nh })._handler = nh;
          es.onerror = () => {
            const fe = es;
            if (fe) {
              const hh = (fe as unknown as { _handler?: typeof nh })._handler;
              if (hh) fe.removeEventListener("job-update", hh);
              fe.close();
              if (es === fe) es = null;
            }
            onUpdateRef();
            reconnectTimer = window.setTimeout(() => onUpdateRef(), 2000);
          };
        }
      }, 2000);
    };
  });

  onCleanup(cleanup);
}
