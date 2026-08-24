(function () {
  const LS_KEY = "theme";
  const LIGHT = "bumblebee";
  const DARK = "dracula";
  function sync() {
    const cb = document.querySelector(".theme-controller");
    const html = document.documentElement;
    if (!cb) return;
    cb.checked = html.getAttribute("data-theme") === DARK;
    if (cb.dataset.themeBound) return;
    cb.dataset.themeBound = "1";
    cb.addEventListener("change", () => {
      const next = cb.checked ? DARK : LIGHT;
      html.setAttribute("data-theme", next);
      try { localStorage.setItem(LS_KEY, next); } catch {}
    });
  }
  document.addEventListener("DOMContentLoaded", sync);
  document.body.addEventListener("htmx:afterSettle", sync);
  document.body.addEventListener("htmx:load", sync);
})();
