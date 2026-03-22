import { BunRequest } from "bun";

export async function not_found(req: BunRequest) {
  const url = new URL(req.url);

  // Try to serve static file from public/
  const filePath = `public${url.pathname}`;
  const file = Bun.file(filePath);

  const exists = await file.exists();
  return exists
    ? new Response(file)
    : new Response("Not found", { status: 404 });
}
