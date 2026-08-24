(function () {
  const LS_KEY = "theme";
  const LIGHT = "bumblebee";
  const DARK = "dracula";
  function sync() {
    const cbs = document.querySelectorAll(".theme-controller");
    const html = document.documentElement;
    if (!cbs.length) return;
    cbs.forEach((cb) => {
      cb.checked = html.getAttribute("data-theme") === DARK;
      if (cb.dataset.themeBound) return;
      cb.dataset.themeBound = "1";
      cb.addEventListener("change", () => {
        const next = cb.checked ? DARK : LIGHT;
        html.setAttribute("data-theme", next);
        try {
          localStorage.setItem(LS_KEY, next);
        } catch {}
      });
    });
  }
  function bindHtmx() {
    document.body.addEventListener("htmx:afterSettle", sync);
    document.body.addEventListener("htmx:load", sync);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      sync();
      bindHtmx();
    });
  } else {
    sync();
    bindHtmx();
  }
  document.addEventListener("htmx:afterSettle", sync);
  document.addEventListener("htmx:load", sync);
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      const v = e.newValue === DARK ? DARK : LIGHT;
      document.documentElement.setAttribute("data-theme", v);
      sync();
    }
  });
})();
