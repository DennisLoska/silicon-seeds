# Text-to-Video Dedicated Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New `/create/text-to-video` page cloned from Video page minus Loras/Style Preset/intermediate image, with sidebar entry, e2e covered.

**Architecture:** Frontend-only clone. No backend change. New `CreateTextToVideo.tsx` posts same `/api/jobs/videos` FormData without loras/preset. Route + sidebar wiring. Playwright e2e proves parity + absence.

**Tech Stack:** SolidJS + @solidjs/router, Tailwind DaisyUI v5, Playwright, Bun, TypeScript

---

### Task 1: Failing e2e for new page

**Files:**
- Create: `e2e/create-text-to-video.spec.ts`
- Modify: none
- Test: `e2e/create-text-to-video.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect } from "@playwright/test";

test("create text-to-video loads without lora/preset, interacts without generating", async ({ page }) => {
  await page.goto("/create/text-to-video");
  await expect(page).toHaveURL(/\/create\/text-to-video/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  const prompt = page.locator('textarea[name="prompt"], #video-prompt').first();
  await expect(prompt).toBeVisible();
  await prompt.fill("a serene mountain lake at sunrise, gentle mist");
  await expect(prompt).toHaveValue(/mountain lake/);

  const styleGuide = page.locator('textarea[name="style_guide"], #style-guide').first();
  await expect(styleGuide).toBeVisible();
  await styleGuide.fill("warm ochre palette, watercolor");
  await expect(styleGuide).toHaveValue(/ochre/);

  const videoModel = page.locator('select[name="video_model"]').first();
  await expect(videoModel).toBeVisible();
  await videoModel.selectOption("wan2.2");

  const fps = page.locator('input[name="fps"][type="range"]').first();
  await expect(fps).toBeVisible();
  await fps.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "12");

  const clip = page.locator('input[name="clip_duration"][type="range"]').first();
  if ((await clip.count()) > 0) {
    await clip.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "5");
  }

  const resolution = page.locator('select[name="resolution"]').first();
  await expect(resolution).toBeVisible();
  await resolution.selectOption("720p");
  await expect(resolution).toHaveValue("720p");

  await expect(page.locator('select[name="style_preset"]')).toHaveCount(0);
  await expect(page.getByText(/Intermediate image \(used for I2V\)/i)).toHaveCount(0);

  const resetBtn = page.getByRole("button", { name: "Reset" }).first();
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(prompt).toHaveValue("");

  const generateHeading = page.getByText(/Generate Video/i).first();
  if ((await generateHeading.count()) > 0) await expect(generateHeading).toBeVisible();

  await expect(page).toHaveURL(/\/create\/text-to-video/);

  const sidebarEntry = page.locator('#sidebar-text-to-video').first();
  await expect(sidebarEntry).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx playwright test e2e/create-text-to-video.spec.ts`
Expected: FAIL with `Target page, context or browser has been closed` or `page.goto: net::ERR_CONNECTION_REFUSED` if dev server down, OR `expect(page).toHaveURL` timeout / `locator #sidebar-text-to-video` not found because route does not exist yet. Any FAIL satisfies TDD red.

- [ ] **Step 3: Commit failing test**

```bash
git add -f e2e/create-text-to-video.spec.ts
git commit -m "test: failing e2e for text-to-video page"
```

### Task 2: Create CreateTextToVideo.tsx stripped clone

**Files:**
- Create: `src/client/pages/CreateTextToVideo.tsx`
- Modify: none (copy source `src/client/pages/CreateVideo.tsx:1-302`)
- Test: `e2e/create-text-to-video.spec.ts`

- [ ] **Step 1: Create file as stripped clone**

Copy `src/client/pages/CreateVideo.tsx` to `src/client/pages/CreateTextToVideo.tsx`, then apply these exact edits:

1. Replace import block `src/client/pages/CreateVideo.tsx:1-7`:
```typescript
import { createSignal, createResource, Show, For } from "solid-js";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useJobUpdates } from "../lib/sse";
import { apiGet, getAssetPath } from "../lib/api-client";
import { Icons } from "../components/Icons";
```
Delete lines: `import LoraSelector, { LoraSpec } from "../components/LoraSelector";` and `import StylePresetSelect from "../components/StylePresetSelect";`

2. Rename `export default function CreateVideo()` → `export default function CreateTextToVideo()`

3. Delete loras signal `const [loras, setLoras] = createSignal<LoraSpec[]>([]);` (`CreateVideo.tsx:17`)

4. In `onSubmit`, delete `if (loras().length) fd.set("loras", JSON.stringify(loras()));` (`CreateVideo.tsx:55`). Replace redirect navigates:
```typescript
navigate(`/create/text-to-video?show_progress=true&job_id=${jid}`);
```
and
```typescript
navigate(`/create/text-to-video?show_progress=true&job_id=${j.jobId}`);
setSearch({ show_progress: "true", job_id: j.jobId });
```
Two occurrences, both `"/create/video?"` → `"/create/text-to-video?"`.

5. Delete `const imageItems = () => ...` (`CreateVideo.tsx:90`). Keep `const videoItems = () => ...` unchanged.

6. Delete entire Style Preset card block (`CreateVideo.tsx:211-220`):
```tsx
<div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
  ...Style Preset...StylePresetSelect...
</div>
```

7. Delete entire Loras card block (`CreateVideo.tsx:222-227`):
```tsx
<div class="card bg-base-100 shadow-xl w-full flex-none flex flex-col">
  ...Loras...LoraSelector...
</div>
```

8. In progress view, change empty-state condition `videoItems().length === 0 && imageItems().length === 0` → `videoItems().length === 0`. Change `videoItems().length === 0 && imageItems().length > 0` intermediate image block (`CreateVideo.tsx:280-293`) → delete entire `<Show>` block.

9. Keep IDs: `#video-prompt`, `#style-guide`, `#submit-btn`, `textarea[name="prompt"]`, `textarea[name="style_guide"]`, `select[name="video_model"]`, `input[name="fps"]`, `input[name="clip_duration"]`, `select[name="resolution"]`.

- [ ] **Step 2: Typecheck new file**

Run: `bunx tsc --noEmit`
Expected: PASS with no new errors in `CreateTextToVideo.tsx` (pre-existing `Icons.tsx` SVG attr errors ignored, must not increase count).

- [ ] **Step 3: Commit**

```bash
git add src/client/pages/CreateTextToVideo.tsx
git commit -m "feat: add CreateTextToVideo stripped clone"
```

### Task 3: Wire route in App.tsx

**Files:**
- Modify: `src/client/App.tsx:10,66-73`
- Test: `e2e/create-text-to-video.spec.ts`

- [ ] **Step 1: Add lazy import**

```typescript
const CreateTextToVideo = lazy(() => import("./pages/CreateTextToVideo"));
```
Place after `const CreateVideo = lazy(() => import("./pages/CreateVideo"));` (`App.tsx:10`).

- [ ] **Step 2: Add route after /create/video block**

```tsx
<Route
  path="/create/text-to-video"
  component={() => (
    <Suspense fallback={<div class="flex justify-center py-16"><span class="loading loading-spinner" /></div>}>
      <CreateTextToVideo />
    </Suspense>
  )}
/>
```
Insert after `App.tsx:66-73` Video route, before Settings route.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat: route /create/text-to-video"
```

### Task 4: Sidebar + title in Layout.tsx

**Files:**
- Modify: `src/client/components/Layout.tsx:6-15,77-82`
- Test: `e2e/create-text-to-video.spec.ts`

- [ ] **Step 1: Add title mapping**

In `getPageTitle` (`Layout.tsx:6`), add before video line:
```typescript
if (path.startsWith("/create/text-to-video")) return "Text to Video";
```
Keep `if (path.startsWith("/create/video")) return "Video";` after it.

- [ ] **Step 2: Add sidebar entry after Video**

```tsx
<li class="w-full">
  <A href="/create/text-to-video" id="sidebar-text-to-video" class="is-drawer-close:justify-center py-2">
    <Icons.Video />
    <span class="is-drawer-close:hidden">Text to Video</span>
  </A>
</li>
```
Insert after Video `</li>` (`Layout.tsx:82`), before Audio entry.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/client/components/Layout.tsx
git commit -m "feat: sidebar Text to Video entry"
```

### Task 5: Green e2e + lint + chrome devtools verify

**Files:**
- Modify: none (verify only)
- Test: `e2e/create-text-to-video.spec.ts`, `e2e/create-video.spec.ts`

- [ ] **Step 1: Run new e2e**

Run: `bunx playwright test e2e/create-text-to-video.spec.ts`
Expected: PASS (1 passed).

- [ ] **Step 2: Run old video e2e regression**

Run: `bunx playwright test e2e/create-video.spec.ts`
Expected: PASS (1 passed, untouched page still works).

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: no new errors in `CreateTextToVideo.tsx`, `App.tsx`, `Layout.tsx`, `create-text-to-video.spec.ts`.

- [ ] **Step 4: Manual + chrome devtools snapshot**

Run: `bun start:hot & sleep 3; curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/create/text-to-video`
Expected: `200`.
Then chrome devtools MCP: `take_snapshot` on `/create/text-to-video`, confirm sidebar `#sidebar-text-to-video`, prompt textarea, no `select[name="style_preset"]`, no Loras text. Screenshot to `/tmp/t2v-page.png`.

- [ ] **Step 5: Commit verify evidence (if fixes needed, amend per finding, else empty commit skipped)**

If all green, no commit. If fixes, commit per file with `fix:` prefix.
