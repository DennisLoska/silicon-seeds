import { Templates } from "../../templates/templates";

export async function media() {
  return new Response(Templates.mediaFragment(), {
    headers: { "Content-Type": "text/html" },
  });
}
