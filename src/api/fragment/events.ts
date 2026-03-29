import { Templates } from "../../templates/templates";

export async function events() {
  return new Response(Templates.eventsFragment(), {
    headers: { "Content-Type": "text/html" },
  });
}
