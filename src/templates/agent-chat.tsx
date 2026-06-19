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
      <div role="tablist" class="tabs tabs-boxed tabs-sm" id="agent-tabs">
        <button
          role="tab"
          class="tab tab-active"
          data-tab="chat"
          id="tab-btn-chat"
        >
          Chat
        </button>
        <button
          role="tab"
          class="tab"
          data-tab="render"
          id="tab-btn-render"
        >
          Render
        </button>
      </div>

      <div id="tab-panel-chat" class="flex-1 flex flex-col min-h-0">
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
          <form id="agent-chat-form" class="flex gap-2 items-center w-full">
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

      <div id="tab-panel-render" class="flex-1 flex flex-col min-h-0 hidden p-3 gap-3">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">Render Video</h3>
        </div>
        <p class="text-xs opacity-60">
          Render the composition to an MP4 file. This may take several minutes.
        </p>
        <button
          id="render-btn"
          class="btn btn-primary btn-sm gap-1 w-full"
          title="Render to MP4"
          hx-post={`/api/jobs/hypercut/${props.jobId}/render`}
          hx-target="#render-output"
          hx-swap="innerHTML"
          hx-disabled-elt="this"
          hx-indicator="#render-loading"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Render
        </button>
        <div id="render-loading" class="hidden">
          <div class="flex items-center gap-2 text-sm opacity-70">
            <span class="loading loading-spinner loading-sm"></span>
            Rendering video — this may take several minutes...
          </div>
        </div>
        <div id="render-output" class="flex-1 overflow-y-auto"></div>
      </div>
    </div>
  );
}
