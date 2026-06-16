# Composition Editing

The composition is an HTML file following HyperFrames Core conventions. You edit it by reading the current HTML, modifying it, and writing it back. The studio iframe auto-reloads after write.

## Composition Structure

- Root: `<div data-composition-id="hypercut-{jobId}" data-width="1920" data-height="1080" data-duration="{seconds}">`
- Clips: `<section class="clip" data-start="0" data-duration="5" data-track-index="1">`
- Tracks: Layers controlled by `data-track-index`. Higher index = on top.
- Video: `<video src="/assets/source/{jobId}" />` for source video
- Images: `<img src="{path}" />` for overlay images
- Audio: `<audio src="{path}" />` for background music or narration

## Editing Rules

1. Read the current composition first. Never overwrite without reading.
2. Preserve existing elements unless user asks to remove them.
3. When adding a clip: pick next available `data-track-index` or overlap intentionally.
4. Duration of clips must fit within the total `data-duration` of the root.
5. After writing, always call `write_composition` to persist changes.
6. For source video, use `data-track-index="1"` as base layer.
7. Overlays (images/text) go on tracks 2+.

## Example: Add Image Overlay

To add an image overlay from time 2s to 7s on track 2:

```html
<section
  class="clip"
  data-start="2"
  data-duration="5"
  data-track-index="2"
  style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
>
  <img src="/assets/output/filename.png" style="max-width: 80%; max-height: 80%;" />
</section>
```

## Example: Add Text Overlay

```html
<section
  class="clip"
  data-start="3"
  data-duration="4"
  data-track-index="3"
  style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;"
>
  <h2 style="color: white; font-size: 48px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">Your Text Here</h2>
</section>
```
