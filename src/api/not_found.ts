export async function not_found() {
  return new Response("Not found", { status: 404 });
}
