import { Event, JobMode } from "../events/events";
import { LLM } from "../llm/llm";
import { comfyClient } from "../comfyui/comfyui-client";
import { Presets, StylePresets } from "../styles/presets";
import { QueueManager } from "../queue/queue-manager";
import assert from "node:assert";
import { ImageGenerator } from "../image/image-generator";
import { VideoGenerator } from "../video/video-generator";
import { Logger } from "../logger/logger";

export namespace PromptGenerator {
  export async function txt_to_img_prompt(
    jobId: string,
    mode: JobMode = JobMode.Image,
    message: string,
    batchSize = 1,
    preset?: Presets,
  ) {
    const instructions = preset
      ? StylePresets.presets[preset]({ title: message })
      : StylePresets.presets[Presets.SYSTEM]({ title: message });

    for (let i = 0; i < batchSize; i++) {
      try {
        const res = await LLM.message(
          `Create an excellent image prompt based on these instructions: ${instructions}`,
        );
        if (res === null || !res.content || res.content.trim() === "") return;
        let prompt = res.content.trim();

        ImageGenerator.schedule_image({ jobId, mode, prompt });
      } catch (error) {
        Logger.error("Error generating image prompt", error);
      }
    }
  }

  export async function img_to_vid_prompt(promptId: string) {
    const event = QueueManager.findEventById(promptId);
    assert(
      event,
      "Unable to find associated event with image for image-to-video prompt.",
    );

    if (event.type !== Event.NewImagePrompt) return;

    const res = await comfyClient.getImageOutput(promptId);
    if (res === null) {
      Logger.info("Failed to fetch image location for video prompt");
      return;
    }

    const { filename, subfolder, kind } = res;
    const img = await comfyClient.getAsset(filename, subfolder, kind);
    const buffer = await img.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    try {
      const image = await LLM.client.files.prepareImageBase64(filename, base64);

      const res = await LLM.message(
        `Generate a detailed video generation prompt for a 5 second long video based on the content of the image.
The video itself should be slow paced without any rapid movement as if time moves a bit slower.

The camera movement should be slow and steady and should not change meaning if the camera does a fade in it should
not do a fade out anymore, but just to continue with the fade in motion until the very end of the video.
The fade in motion is just an example. Depending on the image it makes sense to have no camera movement at all or
to use a different motion like:

fade in, fade out, pan left, pan right, tilt top, tilt bottom

It is very important that you describe the ending position of the video to prevent the video from looping.

Also consider the original prompt which was used to generate the image for richer context:

${event.prompt}`,
        [image],
      );

      VideoGenerator.schedule_video({
        jobId: event.jobId,
        prompt: res.content,
        filename,
      });
    } catch (error) {
      Logger.info("Failed to generate image-to-video prompt", error);
    }
  }

  export function script_prompt(description: string) {
    return `Create a text script / essay based on the following description: ${description}

If the description does not provide details about the length of the essay make sure it is between
800 and 1300 words long depending on the subject.

Make sure to remove any markdown syntax so that the content is just plain text.

Your response should only include the actual essay including it's title - nothing more!
`;
  }

  export async function image_scene_prompts(
    jobId: string,
    mode: JobMode,
    text: string,
    amount: number,
    preset?: Presets,
  ) {
    const instructions = `Here is a text: \n${text}

Your task is to create ${amount} image prompts in chronological order.
Your goal is to visualize the text for purpose of creating a visual novel.

These prompts will be used to generate these images.

The resulting images should contain no text or words in them at all so do not
put any descriptions or instructions for visualizing words, slogans or texts
into the actual prompts. There should be no words, signs.

Your response should only include the list of image prompts - nothing more!
There should be no duplicate prompts in the list make sure each prompt is unique!

The different prompts should not be too similar and have a great amount of variety
between them to ensure the final composition will consist of a wide range of
different scenes.

Ensure each prompt is not longer than 50-200 words and rather use less words if the 
amount of image prompts to be generated is higher than single digit count.

Make sure to return a a valid json array containing exactly ${amount} items of length
${amount} with each prompt being an item of the array.

I believe in you! You can do this! Make no mistakes!
`;

    Logger.info("instructions:", instructions);
    // TODO FIX THIS!!!
    const res = await LLM.message(instructions);
    const scenes = JSON.parse(res?.content);
    Logger.info("scenes: ", scenes);
    Logger.info("amount: ", amount);
    Logger.info("actual: ", scenes.length);

    if (!Array.isArray(scenes)) return null;
    assert(
      scenes.length === amount,
      "LLM did not generate the desired amount of scene prompts.",
    );

    for (const scene of scenes) {
      preset
        ? txt_to_img_prompt(jobId, mode, scene, 1, preset)
        : txt_to_img_prompt(jobId, mode, scene, 1);
    }
  }
}
