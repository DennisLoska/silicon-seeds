import { Event, JobMode } from "../events/events";
import { LLM } from "../llm/llm";
import { comfyClient } from "../comfyui/comfyui-client";
import { Presets, StylePresets } from "../styles/presets";
import { QueueManager } from "../queue/queue-manager";
import { ImageGenerator } from "../image/image-generator";
import { VideoGenerator } from "../video/video-generator";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import z from "zod/v3";

export namespace PromptGenerator {
  export async function txt_to_img_prompt(
    jobId: string,
    mode: JobMode = JobMode.Image,
    message: string,
    batchSize = 1,
    preset?: Presets,
    index?: number,
  ) {
    const styleFn = preset
      ? StylePresets.presets[preset]
      : StylePresets.presets[Presets.SYSTEM];

    const { instructions, lora } = styleFn({ title: message });

    for (let i = 0; i < batchSize; i++) {
      const res = await LLM.message(
        `Create an excellent image prompt based on these instructions:

${instructions}

Make sure to only include the actual image prompt in your response and nothing more!
`,
      );

      if (res === null || !res.content || res.content.trim() === "") {
        Logger.warn("Failed to generate image prompt - skipping");
        // TODO could add retry
        return null;
      }
      const prompt = res.content.trim();

      ImageGenerator.schedule_image({ jobId, mode, prompt, lora, index });
    }
  }

  export async function img_to_vid_prompt(promptId: string) {
    const event = QueueManager.findEventById(promptId);
    Utils.assert(
      event,
      "Unable to find associated event with image for image-to-video prompt.",
    );

    if (event.type !== Event.NewImagePrompt) return;

    const res = await comfyClient.getImageOutput(promptId);
    if (res === null) {
      Logger.info("Failed to fetch image location for video prompt");
      return null;
    }

    const { filename, subfolder, kind } = res;
    const img = await comfyClient.getAsset(filename, subfolder, kind);
    const buffer = await img.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const image = await LLM.client.files.prepareImageBase64(filename, base64);

    const response = await LLM.message(
      `Generate a detailed video generation prompt for a 5 second long video based on the content of the image.
The video itself should be slow paced without any rapid movement as if time moves a bit slower.

The camera movement should be slow and steady and should not change meaning if the camera does a fade in it should
not do a fade out anymore, but just to continue with the fade in motion until the very end of the video.
The fade in motion is just an example. Depending on the image it makes sense to have no camera movement at all or
to use a different motion like:

fade in, fade out, pan left, pan right, tilt top, tilt bottom

It is very important that you describe the ending position of the video to prevent the video from looping.

Also consider the original prompt which was used to generate the image for richer context:

${event.prompt}

Make sure to only include the actual video generation prompt in your response and nothing more!
`,
      [image],
    );

    if (!response?.content) {
      Logger.warn("Failed to generate video prompt - skipping");
      return null;
    }

    VideoGenerator.schedule_video({
      jobId: event.jobId,
      prompt: response.content,
      filename,
      index: event.index,
    });
  }

  export function script_prompt(description: string) {
    return `Create a text script / essay based on the following description: ${description}

If the description does not provide details about the length of the essay make sure it is between
800 and 1300 words long depending on the subject.

Make sure to remove any markdown syntax so that the content is just plain text.

Your response should only include the actual essay including it's title and nothing more!
`;
  }

  export async function image_scene_prompts(
    jobId: string,
    mode: JobMode,
    text: string,
    amount: number,
    preset?: Presets,
  ) {
    const list_prompt = `Image Prompt Instructions:

- Generate a list of ${amount} image prompts
- Ensure each prompt is not longer than ~25-50 words
- The different prompts should be unique and have a great amount of variety
between them to ensure the final composition will consist of a wide range of
different scenes describing the video script.
- Your response should only include the list of image prompts - nothing more!
- There should be no duplicate prompts in the list make sure each prompt is unique!
- The resulting images should contain no text or words in them at all so do not
put any descriptions or instructions for visualizing words, slogans or texts
into the actual prompts. There should be no words, signs.
- Your response should only include the list of generated image prompts

Create a list of ${amount} image prompts in chronological
order which should describe this video script visually in it's totality from
start to finish:

${text}
`;
    const res = await LLM.image_prompt_list(list_prompt, amount);
    if (!res?.parsed) return null;

    let scenes = Object.values(res.parsed);
    Logger.info("scenes: ", res.parsed);
    Logger.info("amount: ", amount);
    Logger.info("actual: ", scenes.length);

    if (!Array.isArray(scenes)) return null;
    Utils.assert(
      scenes.length >= amount,
      "LLM did not generate the desired amount of scene prompts.",
    );

    if (scenes.length > amount) {
      Logger.warn(
        "The model generated more prompts than requested, slicing the array!",
        {
          expected: amount,
          actual: scenes.length,
          scenes,
        },
      );

      scenes = scenes.slice(0, amount);
    }

    for (const scene of scenes) {
      const index = scenes.indexOf(scene);
      if (preset) {
        txt_to_img_prompt(jobId, mode, scene, 1, preset, index);
      } else {
        txt_to_img_prompt(jobId, mode, scene, 1, undefined, index);
      }
    }
  }
}
