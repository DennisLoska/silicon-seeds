import { Templates } from "../../templates/templates";

export async function events() {
  const fragment = await Templates.eventsFragment();
  return new Response(fragment, {
    headers: { "Content-Type": "text/html" },
  });
}
