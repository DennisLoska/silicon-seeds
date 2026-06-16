# HyperCut Chunked Composition Design

## Problem
Initial composition is a single video element with no segmentation. Bad takes (filler words, pauses, restarts) are detected but stored as metadata only — not visible in the timeline UI.

## Solution
Chunk source video into sequential clips based on transcript analysis. Each segment between/over removal spans becomes a separate `TimelineMediaElement`. Bad segments are labeled so they're identifiable in the timeline.

## Design Decisions

### Segmentation Algorithm
1. Get source video duration via `Metadata.getMediaDurationFromPath()`
2. Walk removal spans (sorted by start time)
3. Build alternating segments: good → bad → good → bad ...
4. A "good" segment = gap between removals
5. A "bad" segment = a removal span itself

```
cursor = 0
for each removal (sorted by start):
  if cursor < removal.start:
    emit good segment [cursor, removal.start)
  emit bad segment [removal.start, removal.end] with label
  cursor = removal.end
if cursor < duration:
  emit final good segment [cursor, duration]
```

### Clip Structure
Each clip is a `TimelineMediaElement`:
```
{
  id: "seg-{N}",
  type: "video",
  name: "{LABEL_PREFIX}: {description}" or "Segment {N}",
  startTime: cumulativeTime,
  duration: segDuration,
  zIndex: 0,
  src: `/assets/source/${jobId}`,
  mediaStartTime: sourceStart,
  sourceDuration: segDuration,
}
```

### Labeling Convention
Good segments: `"Segment {N}"`
Filler segments: `"[FILLER] {word}"`
Pause segments: `"[PAUSE] {gapSeconds}s gap"`
Restart segments: `"[RESTART] {text}"`

Also sets `data-name` attribute in HTML via `generateHyperframesHtml()`.

### Duration
Total composition duration = sum of all segment durations = source video duration (nothing removed).

## Files Changed
- `src/hypercut/hypercut-workflow.ts` — modify `generateInitialComposition` to accept removals + duration, build chunked clips
- `src/hypercut/hypercut-transcript-analyzer.ts` — export `RemovalSpan` (already exported)
- `src/hypercut/agentic-editor.ts` — update `get_job_info` to normalize tag naming

## Out of Scope
- Removing bad takes from final render (user/agent decides)
- FFmpeg-based clip extraction (uses mediaStartTime/sourceDuration in browser via hyperframes runtime)
- Modifying the suggestions panel or agent chat
