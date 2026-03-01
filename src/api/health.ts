export function health() {
  return new Response(JSON.stringify({ status: "up" }));
}
