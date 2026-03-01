import { Event } from "../events/events";
import { LLM } from "../llm/llm";
import { comfyClient } from "../comfyui";
import { Presets, StylePresets } from "../styles/presets";

export namespace PromptGenerator {
  export function init() {
    img_to_vid_prompt();
  }

  async function jump_start() {
    const queue = await comfyClient.getQueue();
    if (queue.queue_running.length === 0 && queue.queue_pending.length === 0) {
      Event.emit(Event.NewImage);
    }
  }

  export async function txt_to_img_prompt(
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
            type: Event.NewTextPrompt,
            prompt,
          });

          await jump_start();
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }

  export function img_to_vid_prompt() {
    Event.on(Event.NewImagePrompt, async (event) => {
      const { filename, subfolder, kind } = event;
      const img = await comfyClient.getImage(filename, subfolder, kind);

      const buffer = await img.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      try {
        const image = await LLM.client.files.prepareImageBase64(
          filename,
          base64,
        );
        const prompt = await LLM.message(
          "Generate a detailed video generation prompt for a 5 second long video based on the image",
          { images: [image] },
        );

        // TODO emit event for VideoGenerator to subscribe to (add to queue)
        console.log(prompt?.content);
      } catch (error) {
        console.log(error);
      }
    });
  }
}
