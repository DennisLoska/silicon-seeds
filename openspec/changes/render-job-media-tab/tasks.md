# Implementation Tasks: Render Job Media Tab

## 1. Create API Route Handler for Media Data

- [ ] 1.1 Create `src/api/media.ts` file with route handler function
- [ ] 1.2 Implement database query to fetch events filtered by job_id and status='complete'
- [ ] 1.3 Add LEFT JOIN with meta table to retrieve filename, subfolder, type fields
- [ ] 1.4 Group results by mode (image, video, audio) for template consumption
- [ ] 1.5 Export function for use in templates

## 2. Configure Static Asset Serving

- [ ] 2.1 Add Bun's serveStatic middleware to `src/api/api.tsx` for `/assets/*`
- [ ] 2.2 Set OUTPUT_DIR path (from env var or default "./comfyui/output")
- [ ] 2.3 Verify Bun automatically handles MIME types and 404 responses

## 3. Update Media Template Rendering

- [ ] 3.1 Read `src/templates/media.tsx` and replace placeholder content
- [ ] 3.2 Add DaisyUI card container for each media type section (images, videos, audio)
- [ ] 3.3 Implement image carousel using DaisyUI `carousel` component with `carousel-item` children
- [ ] 3.4 Add HTML5 `<video>` elements with controls attribute for video clips
- [ ] 3.5 Add HTML5 `<audio>` elements with controls attribute for TTS and instrumental tracks
- [ ] 3.6 Add status badges (badge-success for complete, badge-warning for pending)
- [ ] 3.7 Ensure responsive layout using DaisyUI utility classes (sm:, lg: prefixes)

## 4. Wire Up HTMX Tab Navigation

- [ ] 4.1 Verify existing HTMX attributes in `src/templates/job-detail.tsx` are correct
- [ ] 4.2 Test that clicking "Media" tab triggers request to `/api/fragment/job/:jobId?tab=media`
- [ ] 4.3 Confirm fragment is returned and swapped into `#job-tabs-container`

## 5. Testing and Validation

- [ ] 5.1 Create test job with completed media assets (run compose-video API)
- [ ] 5.2 Verify images display correctly in carousel
- [ ] 5.3 Test video playback functionality
- [ ] 5.4 Test audio playback functionality
- [ ] 5.5 Check responsive behavior on mobile and desktop views
- [ ] 5.6 Handle edge case: job with no completed media assets (show empty state)
