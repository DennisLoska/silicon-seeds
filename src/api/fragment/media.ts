import { Templates } from "../../templates/templates";

export async function media() {
  const fragment = await Templates.mediaFragment();
  return new Response(fragment, {
    headers: { "Content-Type": "text/html" },
  });
}
