// postMessage bridge between HTMX parent and @hyperframes/studio iframe

export interface BridgeMessage {
  type: "hypercut-studio-ready" | "composition-loaded" | "error";
  payload?: Record<string, unknown>;
}

export function sendReady() {
  window.parent.postMessage({ type: "hypercut-studio-ready" }, "*");
}

export function sendCompositionLoaded(jobId: string) {
  window.parent.postMessage(
    { type: "composition-loaded", payload: { jobId } },
    "*",
  );
}

export function sendError(message: string) {
  window.parent.postMessage({ type: "error", payload: { message } }, "*");
}

export function onParentMessage(
  handler: (msg: { type: string; payload?: Record<string, unknown> }) => void,
) {
  window.addEventListener("message", (event) => {
    if (event.data?.type?.startsWith("hypercut-")) {
      handler(event.data);
    }
  });
}
