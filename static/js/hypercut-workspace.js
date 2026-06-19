(function () {
  "use strict";

  var jobId = null;

  function init() {
    var ws = document.getElementById("hypercut-workspace");
    if (!ws) return;
    jobId = ws.getAttribute("data-job-id");
    if (!jobId) return;

    initTabs();
    initRegenerate();
    initFullscreen();
    initIframeError();
    initSuggestionFilters();
    initSuggestionActions();
  }

  function api(path, opts) {
    return fetch("/api/jobs/hypercut/" + jobId + path, opts);
  }

  function setBtnState(btn, state, label) {
    if (!btn) return;
    btn.disabled = state === "loading" || state === "done";
    if (state === "loading") {
      btn.innerHTML =
        '<span class="loading loading-spinner loading-xs"></span> ' + label;
    } else if (state === "done") {
      btn.innerHTML = label;
    } else if (state === "error") {
      btn.innerHTML = label;
    } else {
      btn.innerHTML = label;
    }
  }

  function showResult(container, type, html) {
    if (!container) return;
    container.innerHTML =
      '<div class="alert alert-' +
      type +
      ' text-sm mb-2">' +
      html +
      "</div>";
  }

  function clearResult(container) {
    if (container) container.innerHTML = "";
  }

  function initTabs() {
    var tabBtns = document.querySelectorAll("#agent-tabs .tab");
    if (!tabBtns.length) return;

    tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tabName = btn.getAttribute("data-tab");

        tabBtns.forEach(function (b) { b.classList.remove("tab-active"); });
        btn.classList.add("tab-active");

        var chatPanel = document.getElementById("tab-panel-chat");
        var renderPanel = document.getElementById("tab-panel-render");
        if (chatPanel) chatPanel.classList.add("hidden");
        if (renderPanel) renderPanel.classList.add("hidden");

        var target = document.getElementById("tab-panel-" + tabName);
        if (target) target.classList.remove("hidden");
      });
    });
  }

  function initRegenerate() {
    var btn = document.getElementById("regenerate-btn");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var modal = document.getElementById("regenerate-modal");
      if (modal) {
        (document.getElementById("regenerate-modal")).showModal();
      }
    });

    var confirmBtn = document.getElementById("regenerate-confirm");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        var modal = document.getElementById("regenerate-modal");
        if (modal) modal.close();
        doRegenerate(btn);
      });
    }

    var cancelBtn = document.getElementById("regenerate-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        var modal = document.getElementById("regenerate-modal");
        if (modal) modal.close();
      });
    }
  }

  function doRegenerate(btn) {
    setBtnState(btn, "loading", "Regenerating...");
    var result = document.getElementById("render-output");
    showResult(
      result,
      "info",
      '<span class="loading loading-spinner loading-xs"></span> Rebuilding composition from DB...',
    );

    api("/regenerate-composition", { method: "POST" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          setBtnState(btn, "error", "Regenerate");
          showResult(result, "error", data.error);
          setTimeout(function () { setBtnState(btn, "idle", "Regenerate"); }, 2000);
        } else {
          setBtnState(btn, "done", "Done");
          showResult(
            result,
            "success",
            "Composition regenerated with " + data.clips + " clips. Reloading...",
          );
          setTimeout(function () { location.reload(); }, 800);
        }
      })
      .catch(function () {
        setBtnState(btn, "error", "Regenerate");
        showResult(result, "error", "Request failed.");
        setTimeout(function () { setBtnState(btn, "idle", "Regenerate"); }, 2000);
      });
  }

  function initFullscreen() {
    var btn = document.getElementById("fullscreen-btn");
    if (!btn) return;
    var iframe = document.getElementById("hyperframes-studio-iframe");
    if (!iframe) return;

    btn.addEventListener("click", function () {
      if (!document.fullscreenElement) {
        iframe.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener("fullscreenchange", function () {
      if (document.fullscreenElement) {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9H19.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15H19.5M15 15l5.5 5.5"/></svg>';
      } else {
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l4 4m8-4h4m0 0v4m0-4l-4 4M4 16v4m0 0h4m-4 0l4-4m8 4h4m0-4v4m0 0l-4-4"/></svg>';
      }
    });
  }

  function initIframeError() {
    var iframe = document.getElementById("hyperframes-studio-iframe");
    if (!iframe) return;

    var loading = document.getElementById("iframe-loading");
    if (loading) loading.style.display = "flex";

    iframe.addEventListener("load", function () {
      if (loading) loading.style.display = "none";
      iframe.style.opacity = "1";
    });

    iframe.style.opacity = "0";
    iframe.style.transition = "opacity 0.3s";
  }

  function initSuggestionFilters() {
    var radios = document.querySelectorAll('input[name="sug-filter"]');
    if (!radios.length) return;

    radios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        var filter = radio.getAttribute("data-filter");
        var cards = document.querySelectorAll("#suggestions-panel [data-suggestion-type]");

        cards.forEach(function (card) {
          if (!filter) {
            card.style.display = "";
          } else {
            card.style.display = card.getAttribute("data-suggestion-type") === filter ? "" : "none";
          }
        });
      });
    });
  }

  function initSuggestionActions() {
    document.body.addEventListener("htmx:afterRequest", function (e) {
      var el = e.detail.requestingElt;
      if (!el) return;

      if (el.classList.contains("suggestion-skip")) {
        var card = el.closest("[data-suggestion-type]");
        if (card && e.detail.successful) {
          card.style.opacity = "0.3";
          card.style.pointerEvents = "none";
        }
      }

      if (el.classList.contains("suggestion-add")) {
        var card = el.closest("[data-suggestion-type]");
        if (card && e.detail.successful) {
          card.style.opacity = "0.5";
          card.style.borderColor = "var(--su)";
          el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
          el.disabled = true;
        }
      }
    });

    document.body.addEventListener("suggestion-accepted", function () {
      var iframe = document.getElementById("hyperframes-studio-iframe");
      if (iframe && iframe.src) {
        iframe.contentWindow.location.reload();
      }
    });
  }

  init();
})();
