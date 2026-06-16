# DB Integration & Media Search

You have access to a media library and suggestions database.

## Tools Available

### search_media(query, limit)
Semantic search of your media library. Returns matching assets with id, type (image/video/audio), filename, score.
- Embed query text with LLM, search ChromaDB vector index.
- Use for: "find me a video of a beach", "search for nature images", "find something that matches this topic"

### get_suggestions(jobId)
Get all AI-generated suggestions for the current job. Includes autocut_cut (filler words/pauses to remove), and content suggestions (media to add). Returns id, source_type, text_content, asset_id, transcript timestamps.

### accept_suggestion(suggestionId)
Mark a suggestion as accepted. Call this when user confirms they want a suggestion applied. The suggestion data is then usable for composition edits.

### reject_suggestion(suggestionId)
Mark a suggestion as rejected.

### get_transcript(jobId)
Get the full timed transcript of the source video. Returns array of {word, start, end} objects.

### get_job_info(jobId)
Get job metadata: resolution, status, source_video_path, original_prompt.

### read_composition(jobId)
Read the current composition HTML file. Returns the full HTML string.

### write_composition(jobId, html)
Write a new composition HTML file. This replaces the entire composition. After writing, the studio iframe will automatically reload to show changes.

## Search Strategy

When user asks for media:
1. Extract key visual/theme keywords from their request
2. Call `search_media` with those keywords
3. Present results with filenames and scores
4. Ask user which to use, or auto-select best match (score < 0.8 = good match)
5. Integrate selected media into the composition using composition-editing skills
