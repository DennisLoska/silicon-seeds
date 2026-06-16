# HyperCut Chunked Composition Plan

## Task 1: Modify generateInitialComposition signature
- Add `removals: RemovalSpan[]` and `duration: number` parameters
- Import `Metadata` for `getMediaDurationFromPath`
- Import `RemovalSpan` from `hypercut-transcript-analyzer`

## Task 2: Build segment→clip logic
- Sort removals by start
- Walk timeline cursor, alternate good/bad segments
- Build `TimelineMediaElement[]` array
- Calculate cumulative time for `startTime`

## Task 3: Update caller
- In `processUpload`, pass `removals` result and source video duration to `generateInitialComposition`
- Get duration via `Metadata.getMediaDurationFromPath(videoPath)`

## Files
- `src/hypercut/hypercut-workflow.ts` only
