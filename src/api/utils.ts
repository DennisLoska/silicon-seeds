import { Context } from "hono";
import { Templates } from "../templates/templates";

export async function renderFragment(c: Context, fragment: Promise<any> | any) {
  const result = await fragment;

  // If it's an HTMX request, just return the fragment
  if (c.req.header("HX-Request")) {
    return c.html(result);
  }

  // Otherwise, wrap it in the full application layout for a browser load
  return c.html(Templates.layoutPage(Templates.app(result)));
}
