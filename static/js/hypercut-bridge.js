// Sets up the HyperFrames Studio iframe src from the preview subprocess
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var iframe = document.getElementById("hyperframes-studio-iframe");
    if (!iframe) return;

    var jobId = iframe.getAttribute("data-job-id");
    if (!jobId) return;

    fetch("/api/hypercut/" + jobId + "/preview")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.url) iframe.src = data.url;
      })
      .catch(function (err) {
        console.error("HyperCut: preview server error", err);
      });
  });
})();
