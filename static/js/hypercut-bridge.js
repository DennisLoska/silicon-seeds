// Parent-side bridge for communicating with @hyperframes/studio iframe
(function () {
  "use strict";

  var iframe;
  var iframeReady = false;
  var loadingEl = null;

  var pendingMessages = [];

  function showLoadingOverlay(message) {
    if (!loadingEl) {
      loadingEl = document.createElement("div");
      loadingEl.id = "hypercut-loading-overlay";
      loadingEl.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
        "background:var(--color-base-200,#1e1e2e);z-index:10;" +
        "font-family:system-ui,sans-serif;font-size:14px;color:rgba(255,255,255,0.7);";
      var container = document.createElement("div");
      container.style.cssText = "text-align:center;";
      container.innerHTML =
        '<div style="width:24px;height:24px;border:2px solid rgba(255,255,255,0.1);border-top-color:#a6e3a1;border-radius:50%;animation:hc-spin 0.8s linear infinite;margin:0 auto 12px;"></div>' +
        '<p id="hypercut-loading-text" style="margin:0;">' + message + "</p>";
      loadingEl.appendChild(container);
    } else {
      var textEl = document.getElementById("hypercut-loading-text");
      if (textEl) textEl.textContent = message;
    }

    var studioContainer = iframe && iframe.parentElement;
    if (studioContainer && !loadingEl.parentElement) {
      studioContainer.style.position = "relative";
      studioContainer.appendChild(loadingEl);
    }
  }

  function hideLoadingOverlay() {
    if (loadingEl && loadingEl.parentElement) {
      loadingEl.parentElement.removeChild(loadingEl);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    iframe = document.getElementById("hyperframes-studio-iframe");
  });

  // Inject spinner animation
  var styleEl = document.createElement("style");
  styleEl.textContent =
    "@keyframes hc-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(styleEl);

  window.addEventListener("message", function (event) {
    if (event.source !== (iframe && iframe.contentWindow)) return;

    switch (event.data.type) {
      case "hypercut-studio-ready":
        iframeReady = true;
        pendingMessages.forEach(function (msg) {
          iframe.contentWindow.postMessage(msg, "*");
        });
        pendingMessages = [];
        break;
      case "composition-loaded":
        hideLoadingOverlay();
        console.log("HyperCut: composition loaded for job", event.data.payload?.jobId);
        break;
      case "waiting":
        showLoadingOverlay(event.data.payload?.message || "Waiting...");
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

    fetch("/api/jobs/hypercut/suggestions/" + suggestionId + "/accept", {
      method: "POST",
    }).then(function () {
      return fetch("/api/composition/" + jobId + "/add-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: suggestionId }),
      });
    }).then(function () {
      window.sendToStudio("hypercut-reload-composition");
    }).catch(function (err) {
      console.error("Failed to add suggestion:", err);
    });
  });
})();
