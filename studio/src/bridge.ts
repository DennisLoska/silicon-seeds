export function sendReady() {
  window.parent.postMessage({ type: "hypercut-studio-ready" }, "*");
}

export function sendCompositionLoaded(jobId: string) {
  window.parent.postMessage({ type: "composition-loaded", payload: { jobId } }, "*");
}

export function sendWaiting(message: string) {
  window.parent.postMessage({ type: "waiting", payload: { message } }, "*");
}

export function sendError(message: string) {
  window.parent.postMessage({ type: "error", payload: { message } }, "*");
}

export function onParentMessage(handler: (msg: { type: string; payload?: Record<string, unknown> }) => void) {
  const listener = (event: MessageEvent) => {
    if (event.data?.type?.startsWith("hypercut-")) {
      handler(event.data);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
