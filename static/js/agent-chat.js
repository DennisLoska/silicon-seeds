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

    jobId = panel.getAttribute("data-job-id") || panel.closest("[data-job-id]")?.getAttribute("data-job-id");
    if (!jobId) return;

    messagesEl = document.getElementById("agent-chat-messages");
    formEl = document.getElementById("agent-chat-form");
    inputEl = document.getElementById("agent-chat-input");
    if (!inputEl) inputEl = formEl ? formEl.querySelector("textarea[name='message']") : null;

    initAutoResize();
  }

  function initAutoResize() {
    if (!inputEl) return;
    inputEl.addEventListener("input", function () {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 128) + "px";
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (formEl) formEl.requestSubmit();
      }
    });
  }

  function addUserMessage(text) {
    if (!messagesEl) return;

    var wrapper = document.createElement("div");
    wrapper.className = "chat chat-end";

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble-primary text-xs";
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addStreamingResponse() {
    if (!messagesEl) return null;

    var wrapper = document.createElement("div");
    wrapper.className = "ai-response text-xs leading-relaxed";
    wrapper.id = "agent-streaming-msg";

    var content = document.createElement("div");
    content.className = "prose prose-sm max-w-none opacity-80";
    content.innerHTML = '<span class="loading loading-dots loading-sm"></span>';

    wrapper.appendChild(content);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var rawText = "";

    return {
      append: function (text) {
        rawText += text;
        if (rawText.trim()) {
          content.innerHTML = renderMarkdown(rawText);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
      },
      finalize: function () {
        wrapper.removeAttribute("id");
        if (rawText.trim()) {
          content.innerHTML = renderMarkdown(rawText);
        }
      },
      getRaw: function () { return rawText; },
    };
  }

  function addToolIndicator(name) {
    if (!messagesEl) return;

    var existing = document.getElementById("agent-tool-indicator");
    if (existing) existing.remove();

    var div = document.createElement("div");
    div.id = "agent-tool-indicator";
    div.className = "text-xs opacity-40 flex items-center gap-1 py-1";

    div.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Calling tool: ' + escapeHtml(name);

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

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    var html = escapeHtml(text);

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function (m, lang, code) {
      return '<pre class="bg-base-300 rounded p-2 overflow-x-auto text-xs mt-1 mb-1"><code>' + escapeHtml(code.trim()) + "</code></pre>";
    });

    html = html.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 rounded text-xs">$1</code>');

    html = html.replace(/^### (.+)$/gm, '<h4 class="font-bold text-sm mt-2 mb-1">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="font-bold text-sm mt-2 mb-1">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h3 class="font-bold text-sm mt-2 mb-1">$1</h3>');

    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    html = html.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
    html = html.replace(/^\s*(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');

    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";

    html = html.replace(/<p><li/g, "<ul><li");
    html = html.replace(/<\/li><\/p>/g, "</li></ul>");
    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>(<ul>)/g, "$1");
    html = html.replace(/(<\/ul>)<\/p>/g, "$1");

    return html;
  }

  function sendMessage(message) {
    if (streaming || !jobId) return;
    streaming = true;

    addUserMessage(message);
    if (inputEl) {
      inputEl.value = "";
      inputEl.style.height = "auto";
    }
    var streamingMsg = addStreamingResponse();

    var url = "/api/hypercut/" + encodeURIComponent(jobId) + "/chat";

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    })
      .then(async function (response) {
        if (!response.ok) {
          var errText = await response.text();
          if (streamingMsg) {
            streamingMsg.append("[Error: " + errText + "]");
            streamingMsg.finalize();
          }
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
                var loading = streamingMsg.querySelector ? streamingMsg.querySelector(".loading-dots") : null;
                if (loading) loading.remove();
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
          buffer = lines.pop() || "";

          for (var i = 0; i < lines.length; i++) {
            processLine(lines[i]);
          }
        }

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

  init();
  if (formEl) {
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!inputEl || !inputEl.value.trim()) return;
      sendMessage(inputEl.value.trim());
    });
  }

  var quickBtns = document.querySelectorAll("[data-quick-prompt]");
  quickBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var prompt = btn.getAttribute("data-quick-prompt");
      if (prompt && !streaming) {
        sendMessage(prompt);
      }
    });
  });

})();
