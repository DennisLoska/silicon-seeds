(function () {
  "use strict";

  function initBridge() {
    var iframe = document.getElementById("hyperframes-studio-iframe");
    if (!iframe) return;

    var jobId = iframe.getAttribute("data-job-id");
    if (!jobId) return;

    fetch("/api/hypercut/" + jobId + "/preview")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          showIframeError(iframe, data.error);
          return;
        }
        if (data.url) {
          iframe.src = data.url;
        }
      })
      .catch(function (err) {
        showIframeError(iframe, "Preview server unavailable");
      });
  }

  function showIframeError(iframe, msg) {
    var loading = document.getElementById("iframe-loading");
    if (loading) {
      loading.innerHTML =
        '<div class="flex flex-col items-center gap-2 text-center">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' +
        '<p class="text-sm opacity-50">' + msg + "</p>" +
        "</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBridge);
  } else {
    initBridge();
  }
})();
