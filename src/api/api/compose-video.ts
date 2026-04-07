import { AudioGenerator } from "../../audio/audio-generator";
import { comfyClient } from "../../comfyui/comfyui-client";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";
import { TextGenerator } from "../../text/text-generator";

export async function compose_video() {
  const { id: jobId } = await JobOrchestrator.create_job();

  const ttsId = Metadata.randomId();
  const prompt = "A journey with Dante through Inferno.";

  const script = await TextGenerator.create_script(prompt);

  if (!script) {
    return new Response(JSON.stringify({ message: "Oh no" }), { status: 500 });
  }

  AudioGenerator.schedule_audio({
    id: ttsId,
    jobId,
    // TODO remove substring dev hack
    prompt: script.substring(0, 300),
    // prompt: script,
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
    script,
    vidStruct.clipCount,
    Presets.WATERCOLOR,
  );

  return new Response(
    JSON.stringify({ message: "job queued", meta: vidStruct }),
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
