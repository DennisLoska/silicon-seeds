# Gallery Perf + Asset Cache & Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix gallery lag via lazy loading + proper caching/compression for `/static/*` and `/assets/*`

**Architecture:** Two middleware fixes in `src/api/api.tsx` (static + assets) plus template fix in `src/templates/gallery.tsx`. No new deps; use `Bun.gzipSync` and manual header logic. Keep Range+ETag, add compression conditionally.

**Tech Stack:** Bun, Hono `serveStatic`, `Bun.file`, `hono/compress` optional but prefer manual gzip for control, HTMX.

---

### Task 1: Fix static serving — cache + ETag + compression

**Files:**
- Modify: `src/api/api.tsx:71-86`

- [ ] **Step 1: Write failing check (manual)**

Create `/tmp/check_static.sh`:
```bash
curl -s -I http://localhost:3000/static/style.css | grep -i "Cache-Control"
# expect Cache-Control present
curl -s -H "Accept-Encoding: gzip" -I http://localhost:3000/static/style.css | grep -i "Content-Encoding"
# expect gzip
```
Run: `bash /tmp/check_static.sh` → expect FAIL (no headers).

- [ ] **Step 2: Implement static middleware with cache + ETag + gzip**

Replace the no-op middleware + serveStatic block with:

```typescript
import { gzipSync } from "bun"; // if available, else use node:zlib

// Helper to check if compressible
function isCompressible(path: string) {
  return /\.(css|js|json|svg|html|txt)$/i.test(path);
}

app.use("/static/*", async (c, next) => {
  await next();
  if (!c.res.ok) return;
  const path = c.req.path;
  // Cache header - 1 hour for static, must-revalidate
  c.res.headers.set("Cache-Control", "public, max-age=3600, must-revalidate");
  c.res.headers.set("Vary", "Accept-Encoding");
  // ETag handling - serveStatic already sets? We add if missing.
  // Compression: if client accepts gzip and content is compressible
  const acceptEnc = c.req.header("Accept-Encoding") || "";
  if (acceptEnc.includes("gzip") && isCompressible(path) && !c.res.headers.get("Content-Encoding")) {
    const body = await c.res.arrayBuffer();
    if (body.byteLength > 1024) { // only compress >1k
      const compressed = gzipSync(Buffer.from(body));
      // Need to reconstruct response with compressed body
      const newRes = new Response(compressed, {
        status: c.res.status,
        headers: c.res.headers,
      });
      newRes.headers.set("Content-Encoding", "gzip");
      newRes.headers.set("Content-Length", compressed.length.toString());
      c.res = newRes as any;
    }
  }
});
app.use("/static/*", serveStatic({ root: "./", onNotFound: ... }));
```

Alternatively implement post-processing via wrapping serveStatic manually (read file via Bun.file, set headers, handle ETag+304, gzip).

Simpler: replace serveStatic with custom handler similar to /assets but for static, reading from `./static/` dir, handling ETag, Cache-Control, gzip.

- [ ] **Step 3: Verify passes**

Run: `bash /tmp/check_static.sh` → expect PASS (Cache-Control present, Content-Encoding gzip when requested).

- [ ] **Step 4: Commit**

```bash
git add src/api/api.tsx
git commit -m "fix: static cache + compression + ETag"
```

---

### Task 2: Fix assets handler — Vary, Accept-Ranges, compression for text, preserve Range

**Files:**
- Modify: `src/api/api.tsx:91-145`

- [ ] **Step 1: Write failing check**

```bash
curl -s -I http://localhost:3000/assets/<real-file> | grep -i "Vary"
curl -s -H "Accept-Encoding: gzip" -I http://localhost:3000/assets/<real-file>.json | grep -i "Content-Encoding"
```

- [ ] **Step 2: Update handler**

Changes:
- Add `Accept-Ranges: bytes` header to 200 and 206.
- Add `Vary: Accept-Encoding` to all.
- For Range requests: do NOT compress, keep current logic but add headers.
- For full content: if `Accept-Encoding` includes gzip AND `contentType` is compressible (json/svg/html/txt) AND file size > 1k, compress with `Bun.gzipSync`, set `Content-Encoding: gzip`, update `Content-Length`.
- For binary (image/video/audio) skip compression.
- Keep ETag + 304.
- Use streaming: `c.body(await file.arrayBuffer())` is okay for now but ensure not double-loading for compressed path.

Code snippet:
```typescript
const isAssetCompressible = (ct: string) => ct === "application/json" || ct.startsWith("text/");
...
if (!range && acceptEnc.includes("gzip") && isAssetCompressible(contentType)) {
  const buf = await file.arrayBuffer();
  if (buf.byteLength > 1024) {
    const gz = gzipSync(Buffer.from(buf));
    return new Response(gz, { status: 200, headers: {
      "Content-Type": contentType,
      "Content-Length": gz.length.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": etag,
      "Accept-Ranges": "bytes",
      "Vary": "Accept-Encoding",
      "Content-Encoding": "gzip",
    }});
  }
}
```

- [ ] **Step 3: Verify**

Manual curl checks pass, Range still returns 206, binary not compressed.

- [ ] **Step 4: Commit**

```bash
git add src/api/api.tsx
git commit -m "fix: assets Vary Accept-Ranges compression"
```

---

### Task 3: Gallery template — lazy loading + decoding async

**Files:**
- Modify: `src/templates/gallery.tsx:190-223`

- [ ] **Step 1: Write failing check**

Inspect template: `grep -n 'loading=' src/templates/gallery.tsx` → expect missing.

- [ ] **Step 2: Implement**

In `GalleryItemCard`:
```tsx
<img src={assetPath} alt={item.filename} className="w-full" loading="lazy" decoding="async" fetchPriority="low" style="aspect-ratio: auto" />
```
Add `content-visibility: auto` via class or inline? Use `style: "content-visibility:auto"` on card div.
For video keep `preload="metadata"` add `loading` not valid, ensure `decoding` not needed.

- [ ] **Step 3: Verify**

`grep -n 'loading="lazy"' src/templates/gallery.tsx` returns 1
`bunx tsc --noEmit` passes

- [ ] **Step 4: Commit**

```bash
git add src/templates/gallery.tsx
git commit -m "fix: gallery lazy loading decoding async"
```

---

### Task 4: Verification via devtools MCP

**Files:** none — manual

- [ ] **Step 1: Start server `bun start:hot` and curl checks**

- [ ] **Step 2: Chrome devtools navigate to http://0.0.0.0:3000/create/image → click gallery → check network**

Use `chrome-devtools_navigate_page`, `take_snapshot`, `list_network_requests` to verify headers.

- [ ] **Step 3: Confirm no regressions `bunx tsc --noEmit && bun run lint`**

