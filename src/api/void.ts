export async function not_found(req: Request) {
  const url = new URL(req.url);

  // Try to serve static file from public/
  let filePath = `public${url.pathname}`;

  // If path is root, serve index.html
  if (url.pathname === "/") {
    filePath = "public/index.html";
  }

  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (exists) {
    return new Response(file);
  }

  return new Response("Not found", { status: 404 });
}
