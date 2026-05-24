const encoder = new TextEncoder();

type Subscriber = (eventName: string, data?: string) => void;

export namespace JobUpdates {
  const subscribers = new Map<string, Set<Subscriber>>();

  export function publish(jobId: string) {
    const listeners = subscribers.get(jobId);
    if (!listeners) return;

    for (const send of listeners) {
      send("job-update", JSON.stringify({ jobId }));
    }
  }

  export function stream(jobId: string) {
    let cleanup: (() => void) | undefined;

    const stream = new ReadableStream({
      start(controller) {
        let closed = false;

        const send = (eventName: string, data = "{}") => {
          if (closed) return;

          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`),
          );
        };

        const listeners = subscribers.get(jobId) ?? new Set<Subscriber>();
        listeners.add(send);
        subscribers.set(jobId, listeners);

        const keepAlive = setInterval(() => {
          if (closed) return;
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        }, 15000);

        cleanup = () => {
          if (closed) return;
          closed = true;

          clearInterval(keepAlive);
          listeners.delete(send);

          if (listeners.size === 0) {
            subscribers.delete(jobId);
          }

          try {
            controller.close();
          } catch {
            // Ignore close errors from already-closed streams.
          }
        };

        send("connected", JSON.stringify({ jobId }));
      },
      cancel() {
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
