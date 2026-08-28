import { createSignal, createEffect, onMount, onCleanup } from "solid-js";

const THEMES = ["bumblebee", "dracula"] as const;
type Theme = (typeof THEMES)[number];

function isTheme(v: string | null): v is Theme {
  return v === "bumblebee" || v === "dracula";
}

function getInitial(): Theme {
  try {
    const v = localStorage.getItem("theme");
    if (isTheme(v)) return v;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dracula";
  return "bumblebee";
}

// singleton - module scope
const [theme, setTheme] = createSignal<Theme>(getInitial());
let initialized = false;

function initThemeEffect() {
  if (initialized) return;
  initialized = true;
  createEffect(() => {
    const t = theme();
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
  });
}

export function createTheme() {
  initThemeEffect();
  onMount(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "theme" && isTheme(e.newValue)) setTheme(e.newValue);
    };
    window.addEventListener("storage", handler);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => {
      try {
        const stored = localStorage.getItem("theme");
        if (!isTheme(stored)) setTheme(mq.matches ? "dracula" : "bumblebee");
      } catch {}
    };
    mq.addEventListener?.("change", mqHandler);
    onCleanup(() => {
      window.removeEventListener("storage", handler);
      mq.removeEventListener?.("change", mqHandler);
    });
  });
  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === "bumblebee" ? "dracula" : "bumblebee")),
  };
}

// direct singleton exports for Layout etc
export { theme, setTheme };
export const toggleTheme = () => setTheme((t) => (t === "bumblebee" ? "dracula" : "bumblebee"));
