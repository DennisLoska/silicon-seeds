import { createEffect, onCleanup } from "solid-js";

export function sseUrl(jobId: string) {
  return `/jobs/stream?job_id=${encodeURIComponent(jobId)}`;
}

export function useJobUpdates(jobId: () => string | null | undefined, onUpdate: () => void) {
  let es: EventSource | null = null;
  createEffect(() => {
    const id = jobId();
    if (!id) {
      es?.close();
      es = null;
      return;
    }
    es?.close();
    es = new EventSource(sseUrl(id));
    es.addEventListener("job-update", onUpdate);
    es.addEventListener("connected", () => {});
    es.onerror = () => {
      es?.close();
      // simple reconnect via onUpdate trigger after delay
      setTimeout(() => onUpdate(), 2000);
    };
  });
  onCleanup(() => es?.close());
}
