export async function not_found(req: Request) {
  const url = new URL(req.url);

  let filePath = `public${url.pathname}`;

  if (url.pathname === "/") {
    filePath = "public/index.html";
  }

  const file = Bun.file(filePath);

  try {
    const exists = await file.exists();
    if (exists) {
      return new Response(file);
    }
  } finally {
    return new Response("Not found", { status: 404 });
  }
}
