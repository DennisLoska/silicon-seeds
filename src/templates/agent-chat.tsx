export function AgentChat(props: { jobId: string }) {
  return (
    <div id="agent-chat-panel" class="flex flex-col h-full">
      <h3 class="text-sm font-bold px-3 py-2 border-b border-base-300">
        AI Editor
      </h3>

      <div
        id="agent-chat-messages"
        class="flex-1 overflow-y-auto p-3 space-y-2 text-sm"
      >
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-primary text-xs">
            I'm your AI editing assistant. I can help you edit your video, search
            your media library, and manage suggestions. What would you like to do?
          </div>
        </div>
      </div>

      <div class="border-t border-base-300 p-2">
        <form
          id="agent-chat-form"
          class="flex gap-2"
          onsubmit="return handleAgentSubmit(event, this)"
        >
          <input
            type="text"
            name="message"
            placeholder="Ask me to edit your video..."
            class="input input-bordered input-sm flex-1"
            autocomplete="off"
          />
          <button type="submit" class="btn btn-primary btn-sm">
            Send
          </button>
        </form>
      </div>

      <script>
        {/*
        Chat SSE streaming via fetch() — the script is the same regardless
        of jobId because it reads `data-job-id` from the panel element.
        */}
      </script>
    </div>
  );
}
