export function AgentChat(props: { jobId: string }) {
  const quickActions = [
    {
      label: "Cut filler",
      prompt: "Remove all filler words (um, uh, like) from the timeline",
    },
    {
      label: "Tighten pacing",
      prompt: "Tighten the pacing by removing long pauses",
    },
    {
      label: "Add B-roll",
      prompt:
        "Add relevant B-roll images from the content library to cover the cuts",
    },
  ];

  return (
    <div
      id="agent-chat-panel"
      data-job-id={props.jobId}
      class="flex flex-col h-full"
    >
      <div class="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        <div class="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <h3 class="text-sm font-semibold">AI Editor</h3>
      </div>

      <div
        class="flex gap-1 px-2 py-2 border-b border-base-300 flex-wrap"
        id="quick-actions"
      >
        {quickActions.map((qa) => (
          <button
            type="button"
            class="badge badge-outline badge-sm cursor-pointer hover:badge-primary"
            data-quick-prompt={qa.prompt}
          >
            {qa.label}
          </button>
        ))}
      </div>

      <div
        id="agent-chat-messages"
        class="flex-1 overflow-y-auto p-3 space-y-3 text-sm scrollbar-thin"
      ></div>

      <div class="border-t border-base-300 p-3">
        <form id="agent-chat-form" class="flex gap-2 items-end w-full">
          <textarea
            id="agent-chat-input"
            name="message"
            placeholder="Ask me anything..."
            class="textarea textarea-bordered text-sm flex-1 resize-none min-h-[2.5rem] max-h-32 overflow-y-auto leading-5 py-2"
            autocomplete="off"
            rows={1}
          />
          <button
            type="submit"
            class="btn btn-primary btn-sm btn-square shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              ></path>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
