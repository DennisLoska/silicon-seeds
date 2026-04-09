## 1. Database Layer

- [ ] 1.1 Add `Gallery` namespace to `src/db/db.ts` with `listItems()` function that accepts cursor, type filter, and limit parameters
- [ ] 1.2 Implement single JOIN query joining meta → events → jobs tables with filters for meta.type='output' and events.status IN ('success', 'completed')
- [ ] 1.3 Add cursor-based pagination using created_at timestamp comparison
- [ ] 1.4 Export Gallery namespace from db.ts module exports

## 2. API Route Handler

- [ ] 2.1 Create `src/api/gallery/index.tsx` file with Hono router
- [ ] 2.2 Implement `/gallery` GET endpoint that detects HX-Request header and returns full page or fragment accordingly
- [ ] 2.3 Implement `/gallery/items` GET endpoint for paginated item fragments supporting cursor and type query parameters
- [ ] 2.4 Add route registration in `src/api/api.tsx`: `app.route("/gallery", galleryRoutes)`

## 3. Gallery Template Component

- [ ] 3.1 Create `src/templates/gallery.tsx` with async Gallery component
- [ ] 3.2 Build responsive grid layout using Tailwind CSS (grid-cols-1 on mobile, grid-cols-2/3/4 on larger screens)
- [ ] 3.3 Implement media type filter controls (All, Images, Videos, Audio) as clickable buttons or radio inputs
- [ ] 3.4 Add HTMX infinite scroll sentinel div with hx-trigger="revealed", hx-get="/gallery/items", hx-swap="beforeend"
- [ ] 3.5 Include DaisyUI loading spinner in sentinel that shows during fetch
- [ ] 3.6 Implement gallery item card component using DaisyUI card with figure for media display
- [ ] 3.7 Add helper function to determine media type from file extension (image: jpg/png/gif/webp, video: mp4/mov/avi, audio: mp3/wav)
- [ ] 3.8 Add CSS handling for missing images using object-fit with fallback styling
- [ ] 3.9 Export Gallery component in `src/templates/templates.ts`

## 4. Integration & Wiring

- [ ] 4.1 Verify Gallery sidebar link at `/src/templates/app.tsx:109-113` points to correct route and has proper active state
- [ ] 4.2 Add aria-live="polite" attribute to gallery grid container for accessibility

## 5. Testing & Verification

- [ ] 5.1 Test full page navigation to `/gallery` via sidebar link displays correctly with initial items
- [ ] 5.2 Test HTMX partial requests work when navigating between pages then returning to gallery
- [ ] 5.3 Test infinite scroll loads additional batches of 20 items when scrolling to bottom
- [ ] 5.4 Test "No more items" message appears when all content is loaded
- [ ] 5.5 Test media type filters correctly show only selected types and reset on filter change
- [ ] 5.6 Verify items are ordered newest first by created_at timestamp
- [ ] 5.7 Test responsive layout on mobile, tablet, and desktop screen sizes
- [ ] 5.8 Verify events without output files are excluded from gallery
- [ ] 5.9 Test hover effects on cards work as expected