import { Child } from "hono/jsx";
import { Metadata } from "../meta/meta";

export const layout = (children: Child) => (
  <html lang="en" data-theme={Metadata.THEME}>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Silicon Seeds</title>
      <link href="/static/style.css" rel="stylesheet" />
      <script src="/static/htmx.min.js"></script>
    </head>
    <body>{children}</body>
  </html>
);
