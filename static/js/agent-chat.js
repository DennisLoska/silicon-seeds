// Agent chat — fetch-based SSE streaming
(function () {
  "use strict";

  var jobId = null;
  var messagesEl = null;
  var formEl = null;
  var inputEl = null;
  var streaming = false;

  function init() {
    var panel = document.getElementById("agent-chat-panel");
    if (!panel) return;

    // Extract jobId from panel or its closest parent
    jobId = panel.getAttribute("data-job-id") || panel.closest("[data-job-id]")?.getAttribute("data-job-id");
    if (!jobId) return;

    messagesEl = document.getElementById("agent-chat-messages");
    formEl = document.getElementById("agent-chat-form");
    inputEl = formEl ? formEl.querySelector("input[name='message']") : null;
  }

  function addMessage(role, text) {
    if (!messagesEl) return;

    var div = document.createElement("div");
    div.className = "chat " + (role === "user" ? "chat-end" : "chat-start");

    var bubble = document.createElement("div");
    bubble.className =
      "chat-bubble text-sm " +
      (role === "user"
        ? "chat-bubble-accent"
        : "chat-bubble-primary");

    bubble.textContent = text;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addAssistantMessage() {
    if (!messagesEl) return;

    var wrapper = document.createElement("div");
    wrapper.className = "chat chat-start";
    wrapper.id = "agent-streaming-msg";

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble-primary text-sm";
    bubble.textContent = "";
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return {
      append: function (text) {
        bubble.textContent += text;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      },
      finalize: function () {
        wrapper.removeAttribute("id");
      },
    };
  }

  function addToolIndicator(name) {
    if (!messagesEl) return;

    var existing = document.getElementById("agent-tool-indicator");
    if (existing) existing.remove();

    var div = document.createElement("div");
    div.id = "agent-tool-indicator";
    div.className = "chat chat-start opacity-60";

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble text-xs";
    bubble.textContent = "Tool: " + name + "...";
    div.appendChild(bubble);

    // Insert before the streaming message
    var streamingMsg = document.getElementById("agent-streaming-msg");
    if (streamingMsg) {
      messagesEl.insertBefore(div, streamingMsg);
    } else {
      messagesEl.appendChild(div);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeToolIndicator() {
    var el = document.getElementById("agent-tool-indicator");
    if (el) el.remove();
  }

  function sendMessage(message) {
    if (streaming || !jobId) return;
    streaming = true;

    addMessage("user", message);
    if (inputEl) inputEl.value = "";
    var streamingMsg = addAssistantMessage();

    var url = "/api/hypercut/" + encodeURIComponent(jobId) + "/chat";

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    })
      .then(async function (response) {
        if (!response.ok) {
          var errText = await response.text();
          streamingMsg.append("[Error: " + errText + "]");
          streamingMsg.finalize();
          streaming = false;
          return;
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var currentEvent = "";
        var currentData = "";

        function processLine(line) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6);
          } else if (line === "") {
            if (currentEvent && currentData) {
              handleEvent(currentEvent, currentData);
            }
            currentEvent = "";
            currentData = "";
          }
        }

        function handleEvent(eventType, dataStr) {
          var data;
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            data = {};
          }

          switch (eventType) {
            case "token":
              if (data.text && streamingMsg) {
                streamingMsg.append(data.text);
              }
              break;
            case "tool-call":
              removeToolIndicator();
              addToolIndicator(data.name || "unknown");
              break;
            case "done":
              removeToolIndicator();
              if (streamingMsg) streamingMsg.finalize();
              streaming = false;
              break;
            case "error":
              removeToolIndicator();
              if (streamingMsg) streamingMsg.append("[Error: " + (data.message || "unknown") + "]");
              streamingMsg.finalize();
              streaming = false;
              break;
          }
        }

        while (true) {
          var result = await reader.read();
          if (result.done) break;

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split("\n");
          // Keep last partial line in buffer
          buffer = lines.pop() || "";

          for (var i = 0; i < lines.length; i++) {
            processLine(lines[i]);
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          processLine(buffer);
        }

        if (streaming) {
          streaming = false;
        }
      })
      .catch(function (err) {
        if (streamingMsg) streamingMsg.append("[Connection error: " + err.message + "]");
        streamingMsg.finalize();
        streaming = false;
      });
  }

  // Init immediately — runs on page load and after HTMX swaps (HTMX execs scripts sync)
  init();
  if (formEl) {
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!inputEl || !inputEl.value.trim()) return;
      sendMessage(inputEl.value.trim());
    });
  }

})();
