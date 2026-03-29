import { jsxRenderer } from "hono/jsx-renderer";

export const layout = jsxRenderer(({ children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Silicon Seeds</title>
      <link href="/static/style.css" rel="stylesheet" />
      <script src="/static/htmx.min.js"></script>
    </head>
    <body>{children}</body>
  </html>
));
