import { Templates } from "../../templates/templates";

export async function status() {
  return new Response(Templates.statusFragment(), {
    headers: { "Content-Type": "text/html" },
  });
}
