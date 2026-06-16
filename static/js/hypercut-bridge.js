// Parent-side bridge for communicating with @hyperframes/studio iframe
(function () {
  "use strict";

  var iframe;
  var iframeReady = false;

  // Queue messages sent before iframe is ready
  var pendingMessages = [];

  document.addEventListener("DOMContentLoaded", function () {
    iframe = document.getElementById("hyperframes-studio-iframe");
  });

  window.addEventListener("message", function (event) {
    if (event.source !== (iframe && iframe.contentWindow)) return;

    switch (event.data.type) {
      case "hypercut-studio-ready":
        iframeReady = true;
        // Flush pending messages
        pendingMessages.forEach(function (msg) {
          iframe.contentWindow.postMessage(msg, "*");
        });
        pendingMessages = [];
        break;
      case "composition-loaded":
        console.log("HyperCut: composition loaded for job", event.data.payload?.jobId);
        break;
      case "error":
        console.error("HyperCut studio error:", event.data.payload?.message);
        break;
    }
  });

  window.sendToStudio = function (type, payload) {
    var msg = { type: type, payload: payload || {} };
    if (iframeReady && iframe) {
      iframe.contentWindow.postMessage(msg, "*");
    } else {
      pendingMessages.push(msg);
    }
  };

  // Handle "Add to Timeline" clicks
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".add-to-timeline");
    if (!btn) return;

    var jobId = btn.getAttribute("data-job-id");
    var suggestionId = btn.getAttribute("data-suggestion-id");

    // Mark as accepted in backend
    fetch("/api/jobs/hypercut/suggestions/" + suggestionId + "/accept", {
      method: "POST",
    }).then(function () {
      // Tell backend to regenerate composition with this suggestion
      return fetch("/api/composition/" + jobId + "/add-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: suggestionId }),
      });
    }).then(function () {
      // Reload composition in iframe
      window.sendToStudio("hypercut-reload-composition");
    }).catch(function (err) {
      console.error("Failed to add suggestion:", err);
    });
  });
})();
