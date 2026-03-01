import { Event } from "../events/events";
import { LLM } from "../llm/llm";
import { comfyClient } from "../comfyui";
import { Presets, StylePresets } from "../styles/presets";

export namespace PromptGenerator {
  export function init() {
    img_to_vid_prompt();
  }

  async function jump_start(emitter: () => void) {
    const queue = await comfyClient.getQueue();
    if (queue.queue_running.length === 0 && queue.queue_pending.length === 0) {
      emitter();
    }
  }

  export async function txt_to_img_prompt(
    jobId: string,
    message: string,
    batchSize = 1,
    preset?: Presets,
  ) {
    const instructions = preset
      ? StylePresets.presets[preset]({ title: message })
      : message;

    for (let i = 0; i < batchSize; i++) {
      LLM.message(
        `Create an excellent image prompt based on these instructions: ${instructions}`,
      )
        .then(async (res) => {
          if (res === null || !res.content || res.content.trim() === "") return;
          let prompt = res.content.trim();

          Event.emit(Event.NewTextPrompt, {
            id: Bun.randomUUIDv7(),
            jobId,
            type: Event.NewTextPrompt,
            prompt,
          });

          await jump_start(() => {
            Event.emit(Event.NewImage, {
              id: Bun.randomUUIDv7(),
              jobId,
              type: Event.NewImage,
            });
          });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }

  export function img_to_vid_prompt() {
    Event.on(Event.NewImagePrompt, async (event) => {
      // TODO add condition somewhere whether user actually wants video or not

      const { filename, subfolder, kind } = event;
      const img = await comfyClient.getImage(filename, subfolder, kind);

      const buffer = await img.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      try {
        const image = await LLM.client.files.prepareImageBase64(
          filename,
          base64,
        );

        const res = await LLM.message(
          "Generate a detailed video generation prompt for a 5 second long video based on the content of the image",
          [image],
        );

        Event.emit(Event.NewVideoPrompt, {
          id: Bun.randomUUIDv7(),
          type: Event.NewVideoPrompt,
          jobId: "TODO",
          prompt: res.content,
          filename,
        });

        await jump_start(() => {
          Event.emit(Event.NewVideo, {
            id: Bun.randomUUIDv7(),
            type: Event.NewVideo,
            jobId: "TODO",
          });
        });
      } catch (error) {
        console.log(error);
      }
    });
  }

  export function script_prompt(description: string) {
    return `Create a text script / essay based on the following description: ${description}

If the description does not provide details about the length of the essay make sure it is between
800 and 1300 words long depending on the subject.

Your response should only include the actual essay including it's title - nothing more!
`;
  }

  export async function image_scene_prompts(
    jobId: string,
    text: string,
    amount: number,
    preset?: Presets,
  ) {
    const instructions = `Here is a text: \n${text}

Your task is to create ${amount} image prompts in chronological order.
Your goal is to visualize the text for purpose of creating a visual novel.

These prompts will be used to generate these images.

Your response should only include the list of image prompts - nothing more!

Make sure to return a json array with each prompt being an item of the array.
`;

    const res = await LLM.message(instructions);
    const scenes = JSON.parse(res?.content ?? "DEBUG");
    if (!Array.isArray(scenes)) return null;

    for (const scene of scenes) {
      preset
        ? txt_to_img_prompt(jobId, scene, 1, preset)
        : txt_to_img_prompt(jobId, scene, 1);
    }
  }
}
