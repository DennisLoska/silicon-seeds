import { Child } from "hono/jsx";

export const Layout = ({ children }: { children: Child }) => (
  <html lang="en" data-theme="bumblebee">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Silicon Seeds</title>
      <link href="/static/style.css" rel="stylesheet" />
      <script src="/static/htmx.min.js"></script>
      <script defer src="/static/alpine.min.js"></script>
      <script defer src="/static/handlers.js"></script>
    </head>
    <body>{children}</body>
  </html>
);
