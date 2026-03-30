import { Templates } from "../../templates/templates";

export async function status() {
  const fragment = await Templates.statusFragment();
  return new Response(fragment, {
    headers: { "Content-Type": "text/html" },
  });
}
