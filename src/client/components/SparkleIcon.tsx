import { createUniqueId } from "solid-js";

export default function SparkleIcon(props: { class?: string }) {
  const gid = createUniqueId();
  const glow = "drop-shadow(0 0 2px rgba(217,70,239,.65))";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class={props.class ?? "w-3.5 h-3.5"}
      style={{ filter: glow }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8b5cf6" />
          <stop offset=".55" stop-color="#d946ef" />
          <stop offset="1" stop-color="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M11 2c.7 5.4 2.6 7.3 8 8-5.4.7-7.3 2.6-8 8-.7-5.4-2.6-7.3-8-8 5.4-.7 7.3-2.6 8-8z"
      />
      <path
        fill={`url(#${gid})`}
        opacity=".9"
        class="animate-pulse"
        d="M18.5 13c.4 3 1.5 4.1 4.5 4.5-3 .4-4.1 1.5-4.5 4.5-.4-3-1.5-4.1-4.5-4.5 3-.4 4.1-1.5 4.5-4.5z"
      />
      <path
        fill={`url(#${gid})`}
        opacity=".75"
        class="animate-pulse [animation-delay:.7s]"
        d="M5.8 15.5c.3 2.3 1.2 3.2 3.5 3.5-2.3.3-3.2 1.2-3.5 3.5-.3-2.3-1.2-3.2-3.5-3.5 2.3-.3 3.2-1.2 3.5-3.5z"
      />
      <circle cx="15.2" cy="5.4" r="1.1" fill="#fff" opacity=".9" />
    </svg>
  );
}
