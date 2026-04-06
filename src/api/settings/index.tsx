import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();
const { Layout, Settings, App } = Templates;

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return content fragment + OOB header update
    return c.html(
      <>
        <Templates.Settings />
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="settings">
        <Settings />
      </App>
    </Layout>,
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
