# Design: Gallery Performance + Asset Caching & Compression

## Problem
- Gallery lag on navigation/scroll, especially `/gallery` and `/create/image` → gallery fragment.
- Root causes identified:
  1. `/static/*` served without `Cache-Control`, `ETag`, `Last-Modified` — commented out. Every nav re-fetches CSS/JS.
  2. `/assets/*` has cache headers but no compression (gzip/brotli), no `Accept-Encoding` handling, serves full files via `arrayBuffer()` — large images/videos unoptimized.
  3. Gallery template loads full-resolution images at `w-full` with no lazy loading, no `loading="lazy"`, no `decoding="async"`, no thumbnail, no `srcset`. Initial 20 items + infinite scroll all eager.
  4. No pagination limit optimization — potential over-fetch.
  5. No pre-compressed static assets, no `Content-Encoding`, no `Vary: Accept-Encoding`.

## Goals
- Gallery scroll/navigation feels instant (no jank, no re-fetch flicker).
- Static assets cached immutably where possible, validated otherwise.
- Media assets served efficiently with range support preserved + compression for compressible types.
- Validate via devtools MCP at `http://0.0.0.0:3000/create/image` → navigate gallery, check network headers.

## Non-goals
- No image transcoding pipeline (thumbnails/webp generation) in v1 — add lazy + decoding first, thumbnail infra as follow-up if needed.
- No CDN.

## Approaches Considered

### A. Minimal headers only
Add `Cache-Control` to `/static` via `serveStatic`, add `loading=lazy` to gallery images.
- Pro: tiny.
- Con: no compression → still large over wire, no ETag, no immutable for versioned assets.

### B. Middleware + template fix (recommended)
- Use Hono `compress` or custom gzip/brotli for `/static` + `/assets` (check Accept-Encoding, compress text/css/js/json, skip already compressed images/videos).
- Fix `/static/*` to set `Cache-Control: public, max-age=31536000, immutable` for hashed? But we have no hash — use `public, max-age=3600, must-revalidate` + `ETag`.
- Fix `/assets/*` to add `Vary: Accept-Encoding`, `Accept-Ranges`, keep existing ETag/Range, add compression for json/text, ensure `Content-Encoding` not applied to already compressed binaries.
- Gallery template: add `loading="lazy"`, `decoding="async"`, `fetchpriority="low"` for below-fold, keep `preload=metadata` for video, add width/height or aspect ratio placeholder to avoid layout shift.
- Optional: compress static files at build (`gzip -k` via `build:css`) and serve precompressed if available.
- Con: more code, need to handle range+compression interaction.

### C. Full CDN + thumbnail service
Generate thumbnails via sharp, serve `srcset`. Heavy, out of scope for this fix.

**Recommendation: B**.

## Design (B)

### Component 1: Static asset serving (`src/api/api.tsx`)
- Replace no-op middleware with real cache headers.
- `serveStatic` options: `onFound` equivalent or post-middleware to set headers:
  - `Cache-Control: public, max-age=3600, must-revalidate` for `/static/*` (CSS/JS change often, but cache 1h)
  - Alternative: `max-age=31536000, immutable` only if file contains hash — we don't hash, so use 3600.
  - Add `ETag` + handle `If-None-Match → 304` for static.
  - Add `Vary: Accept-Encoding` + compress if client supports gzip/br.
- Use `hono/compress` if available or manual `Bun.gzipSync` / check file exists `.gz` / `.br`.
- Verify: `curl -H "Accept-Encoding: gzip" -I http://localhost:3000/static/style.css` should return `Content-Encoding: gzip` + `Cache-Control`.

### Component 2: Media asset serving (`/assets/*` handler)
- Keep existing ETag + Range (206) + Cache-Control `public, max-age=31536000, immutable` (media filenames are content-hashed by ComfyUI? Assume immutable).
- Add `Accept-Ranges: bytes`, `Vary: Accept-Encoding`.
- For compressible types (json, maybe svg), apply gzip if `Accept-Encoding` includes gzip and `Range` not present (can't compress range). For binary (png/jpg/mp4/webm/wav/mp3) skip compression.
- Ensure `Content-Encoding` header set when compressed.
- Fix bug: currently `c.body(await file.arrayBuffer())` loads whole file into memory — stream or use `Bun.file` response where possible to avoid memory bloat for large videos.

### Component 3: Gallery template (`src/templates/gallery.tsx`)
- Add `loading="lazy"` + `decoding="async"` to `<img>`.
- Add `width`/`height` or CSS `aspect-ratio` placeholder to reduce CLS.
- Keep `preload="metadata"` for video, add `loading="lazy"` not valid for video but use `preload="metadata"` + `poster` if available.
- Ensure sentinel infinite scroll not firing too eagerly — already `hx-trigger="revealed"` OK.
- Optional: add `content-visibility: auto` CSS for offscreen cards.

### Component 4: Verification via devtools MCP
- Steps:
  1. `bun start:hot` then `curl -I` checks for cache/compress headers.
  2. Navigate `http://0.0.0.0:3000/create/image` via chrome-devtools_navigate, then click gallery link, snapshot, check network requests for `Cache-Control`, `Content-Encoding`, `ETag`.
  3. Measure gallery scroll perf: check no duplicate fetches, images lazy.

## Data Flow
Request → Hono `/static` or `/assets` middleware → ETag check → (compress if eligible + Accept-Encoding) → response with cache/compression headers.
Gallery page → initial 20 items → scroll → sentinel `revealed` → `/gallery/items?cursor=...` → append columns.

## Error Handling
- If `If-None-Match` matches → 304, no body.
- Range + compression incompatible → serve range without compression, prioritize range.
- Missing file → 404, log warn.
- Compress failure → fallback to uncompressed.

## Testing
- Unit: `getContentType` remains correct.
- Manual: curl with/without Accept-Encoding, with/without If-None-Match, with Range.
- Devtools MCP: verify headers on static + assets.
- No existing test suite — manual verification only.

## Open Questions
- Do we want build-time precompression (`static/style.css.gz`)? V1 can do runtime gzip, precompression as follow-up.

## Success Criteria
- `/static/style.css` returns `Cache-Control: public, max-age=3600, must-revalidate` (or similar) + `ETag` + `Vary` + `Content-Encoding: gzip` when Accept-Encoding includes gzip.
- `/assets/<image>` returns `Cache-Control: public, max-age=31536000, immutable` + `ETag` + `Accept-Ranges` + no double compression for binary.
- Gallery images have `loading="lazy"` `decoding="async"`.
- Navigating to gallery after first load does not re-fetch static assets (304 or cache hit), scroll not janky.
