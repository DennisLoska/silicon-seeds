export function AgentChat(props: { jobId: string }) {
  return (
    <div id="agent-chat-panel" class="flex flex-col h-full">
      <div class="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        <div class="w-2 h-2 rounded-full bg-primary" />
        <h3 class="text-sm font-semibold">AI Editor</h3>
      </div>

      <div
        id="agent-chat-messages"
        class="flex-1 overflow-y-auto p-3 space-y-3 text-sm scrollbar-thin"
      >
        <div class="chat chat-start">
          <div class="chat-bubble chat-bubble-primary text-xs">
            I'm your AI editing assistant. I can help you edit your video, search
            your media library, and manage suggestions. What would you like to do?
          </div>
        </div>
      </div>

      <div class="border-t border-base-300 p-3">
        <form
          id="agent-chat-form"
          class="join w-full"
        >
          <input
            type="text"
            name="message"
            placeholder="Ask me anything..."
            class="input input-bordered input-sm join-item flex-1"
            autocomplete="off"
          />
          <button type="submit" class="btn btn-primary btn-sm join-item">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
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
