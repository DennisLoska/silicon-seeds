import { describe, it, expect } from "bun:test";
import { generateStandaloneHtml } from "./generate-standalone-html";
import type { TimelineMediaElement } from "@hyperframes/core";

describe("generateStandaloneHtml", () => {
  const elements: TimelineMediaElement[] = [
    {
      id: "seg-0",
      type: "video",
      name: "Segment 1",
      startTime: 0,
      duration: 5.2,
      zIndex: 0,
      src: "source_test.mp4",
      mediaStartTime: 0,
      sourceDuration: 5.2,
    },
    {
      id: "seg-1",
      type: "video",
      name: "[FILLER] um",
      startTime: 5.2,
      duration: 3.1,
      zIndex: 0,
      src: "source_test.mp4",
      mediaStartTime: 5.2,
      sourceDuration: 3.1,
    },
  ];

  const opts = {
    compositionId: "hypercut-test",
    resolution: "landscape" as const,
    sourceVideoFilename: "source_test.mp4",
  };

  it("produces valid HTML with data-composition-id on #stage root", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain('id="stage"');
    expect(html).toContain('data-composition-id="hypercut-test"');
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-duration="8.3"');
  });

  it("does NOT put data-composition-id on <html>", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).not.toMatch(/<html[^>]*data-composition-id/);
  });

  it("emits class=clip on each video element", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain('class="clip"');
    expect(html).toContain('id="seg-0"');
    expect(html).toContain('id="seg-1"');
  });

  it("emits data-start, data-duration, data-track-index on clips", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain('data-start="0" data-duration="5.2" data-track-index="0"');
    expect(html).toContain('data-start="5.2" data-duration="3.1" data-track-index="0"');
  });

  it("emits data-media-start for media offset", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain('data-media-start="0"');
    expect(html).toContain('data-media-start="5.2"');
  });

  it("emits data-name with clip label", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain('data-name="Segment 1"');
    expect(html).toContain('data-name="[FILLER] um"');
  });

  it("does NOT include window.__timelines script", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).not.toContain("__timelines");
  });

  it("clips are direct children of #stage (no wrapper div)", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    const stageMatch = html.match(/<div id="stage"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/);
    expect(stageMatch).toBeTruthy();
    const stageContent = stageMatch![1].trim();
    expect(stageContent).toContain('<video id="seg-0"');
    expect(stageContent).toContain('<video id="seg-1"');
    expect(stageContent).not.toMatch(/<div[^>]*>\s*<video/);
  });

  it("supports portrait resolution", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      ...opts,
      resolution: "portrait",
    });

    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
  });

  it("supports square resolution", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      ...opts,
      resolution: "square",
    });

    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1080"');
  });

  it("includes muted and playsinline on video elements", () => {
    const html = generateStandaloneHtml(elements, 8.3, opts);

    expect(html).toContain("muted");
    expect(html).toContain("playsinline");
  });
});
