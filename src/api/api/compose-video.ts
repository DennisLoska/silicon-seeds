import { AudioGenerator } from "../../audio/audio-generator";
import { comfyClient } from "../../comfyui/comfyui-client";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { PostCompose } from "../schemas";

export async function compose_video(options: PostCompose) {
  const {
    script,
    script_file,
    style_preset,
    fps,
    resolution,
    clip_duration,
    transition_duration,
    image_model,
    video_model,
  } = options;

  // Determine the final script: file takes precedence over text input
  let finalScript = script?.trim();
  
  if (script_file) {
    // Read the uploaded file content
    const fileContent = await script_file.text();
    finalScript = fileContent.trim();
  }

  if (!finalScript || finalScript.length < 3) {
    return new Response(JSON.stringify({ error: "Script is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: jobId } = await JobOrchestrator.create_job({
    fps,
    resolution,
    clip_duration,
    transition_duration,
    image_model,
    video_model,
    style_preset,
  });

  const ttsId = Metadata.randomId();

  AudioGenerator.schedule_audio({
    id: ttsId,
    jobId,
    prompt: finalScript,
  });

  const ttsRes = (await AudioGenerator.get_audio(ttsId)) as any;
  const ttsMeta = ttsRes?.data?.audio?.[0];
  const tts = await comfyClient.getAsset(
    ttsMeta.filename,
    ttsMeta.subfolder,
    ttsMeta.type,
  );

  const duration = await Metadata.getAudioDuration(tts);

  AudioGenerator.schedule_audio({
    jobId,
    duration,
  });

  const vidStruct = derive_video_structure(duration);

  void PromptGenerator.image_scene_prompts(
    jobId,
    JobMode.Video,
    finalScript,
    vidStruct.clipCount,
    style_preset,
  );

  return new Response(
    JSON.stringify({ message: "job queued", meta: vidStruct }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "HX-Redirect": `/compose?show_progress=true&job_id=${jobId}`,
      },
    },
  );
}

function derive_video_structure(duration: number) {
  const { CLIP_DURATION, TRANSITION_DURATION } = Metadata;

  // Base equation: duration = (Metadata.CLIP_DURATION * x) + (Metadata.TRANSITION_DURATION * (x - 1))
  const clipCount = Math.ceil(
    (duration + TRANSITION_DURATION) / (CLIP_DURATION + TRANSITION_DURATION),
  );

  return {
    audioDuration: duration,
    totalDuration:
      clipCount * CLIP_DURATION + (clipCount - 1) * TRANSITION_DURATION,
    clipCount,
  };
}
