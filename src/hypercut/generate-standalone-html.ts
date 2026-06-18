import type { TimelineMediaElement } from "@hyperframes/core";

export interface GenerateStandaloneHtmlOptions {
  compositionId: string;
  resolution: "landscape" | "portrait" | "square";
  sourceVideoFilename: string;
}

const RESOLUTION_DIMS: Record<string, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export function generateStandaloneHtml(
  elements: TimelineMediaElement[],
  totalDuration: number,
  options: GenerateStandaloneHtmlOptions,
): string {
  const { compositionId, resolution, sourceVideoFilename } = options;
  const { width, height } = RESOLUTION_DIMS[resolution] ?? RESOLUTION_DIMS.landscape;

  const clipsHtml = elements
    .map((el) => {
      const attrs = [
        `id="${el.id}"`,
        `class="clip"`,
        `data-start="${el.startTime}"`,
        `data-duration="${el.duration}"`,
        `data-track-index="${el.zIndex ?? 0}"`,
        `data-media-start="${el.mediaStartTime ?? 0}"`,
        `data-name="${el.name}"`,
      ].join(" ");

      return `      <video ${attrs} src="${sourceVideoFilename}" muted playsinline></video>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>HyperCut ${compositionId}</title>
    <style>
      body { margin: 0; background: #000; }
      #stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      .clip { position: absolute; inset: 0; }
      video.clip { width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <div id="stage"
      data-composition-id="${compositionId}"
      data-start="0"
      data-width="${width}"
      data-height="${height}"
      data-duration="${totalDuration}"
    >
${clipsHtml}
    </div>
  </body>
</html>`;
}
