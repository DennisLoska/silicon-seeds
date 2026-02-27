import EventEmitter from "node:events";
import { LLM } from "../llm/llm";

export namespace PromptGenerator {
  const events = new EventEmitter();

  events.on("new_image_prompt", (event) => {
    console.log(event);
  });

  export async function txt_to_img_prompt(content: string, count = 1) {
    for (let i = 0; i < count; i++) {
      LLM.message(`Create an excellent image prompt for: ${content}`)
        .then((res) => {
          if (!res.content || res.content.trim() === "") return;
          const prompt = res.content.trim();
          events.emit("new_image_prompt", { id: Bun.randomUUIDv7(), prompt });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }

  export async function img_to_vid_prompt(img: Blob) {
    events.emit("start image to video prompt");

    const buffer = await img.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const prompt = await LLM.message(
      "Generate a detailed video generation prompt for a 5 second long video based on the image",
      // TODO fix this
      // { image: { format: "png", base64 } },
    );
  }
}

PromptGenerator.txt_to_img_prompt(
  "Jesus gets lead into the desert by the holy spirit.",
  50,
);
