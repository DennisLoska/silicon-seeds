import { Child } from "hono/jsx";

export const Layout = ({ children }: { children: Child }) => (
  <html lang="en" data-theme="bumblebee">
    <head>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var k="theme",l="bumblebee",d="dracula",t=localStorage.getItem(k);if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?d:l;document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`,
        }}
      />
      <meta charset="UTF-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover"
      />
      <title>Silicon Seeds</title>
      <link href="/static/style.css" rel="stylesheet" />
      <script src="/static/htmx.min.js"></script>
      <script src="/static/htmx-ext-sse.min.js"></script>
      <script defer src="/static/alpine.min.js"></script>
      <script defer src="/static/handlers.js"></script>
      <script defer src="/static/theme.js"></script>
    </head>
    <body>{children}</body>
  </html>
);
