import { Metadata } from "../meta/meta";
import zImageTurboApi from "./api/image_z_image_turbo_12_steps_720p.json";
import wan2_2_img2vidApi from "./api/video_wan2_2_14B_i2v_720p_5s.json";
import wan2_2_img2vidWorkflow from "./workflows/video_wan2_2_14B_i2v_720p_5s.json";
import assert from "node:assert";

type Text2ImgInput = {
  id: string;
  kind: "text-to-image";
  prompt: string;
};

type Img2VidInput = {
  id: string;
  kind: "image-to-video";
  imagePath: string;
  prompt: string;
};

const OUTPUT_DIR = Bun.env.OUTPUT_DIR;
const INPUT_DIR = Bun.env.INPUT_DIR;
const COMFYUI_BASE_URL = Bun.env.COMFYUI_BASE_URL;
assert(
  OUTPUT_DIR && INPUT_DIR && COMFYUI_BASE_URL,
  "ComfyUI env. variables not configured!",
);

export type WorkflowInput = Text2ImgInput | Img2VidInput;

export class ComfyUIClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: Text2ImgInput | Img2VidInput) {
    const api = this.buildApi(input);
    const body = this.buildBody(input, api);

    await this.prepareInput(input);

    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to generate content: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
  }

  async getHistory(promptId: string): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }
    return response.json();
  }

  async getQueue(): Promise<{
    queue_running: unknown[];
    queue_pending: unknown[];
  }> {
    const response = await fetch(`${this.baseUrl}/queue`);
    if (!response.ok) {
      throw new Error(`Failed to get queue status: ${response.statusText}`);
    }
    return response.json();
  }

  async getImageOutput(promptId: string): Promise<{
    filename: string;
    subfolder: string;
    kind: "input" | "output" | "temp";
  } | null> {
    const history = await comfyClient.getHistory(promptId);
    const historyNode = history[promptId];

    const images: {
      filename: string;
      subfolder: string;
      kind: "input" | "output" | "temp";
    }[] = [];

    const outputs = Object.values(historyNode.outputs);
    assert(
      outputs.length === 1,
      `ComfyUI job should have exactly one item in history, found: ${JSON.stringify(outputs)}`,
    );

    const [output] = outputs as any;
    const [image] = output.images;
    assert(
      image.subfolder === "",
      `Expected 'subfolder' to be "" (empty), but found '${image.subfolder}'`,
    );

    images.push({
      filename: image.filename,
      subfolder: image.subfolder,
      kind: image.type,
    });

    assert(
      images.length === 1,
      "There should be only one image per ComfyUI job",
    );

    return images[0];
  }

  async getImage(
    filename: string,
    subfolder: string,
    folder_type: "input" | "output" | "temp",
  ): Promise<Blob> {
    const data = new URLSearchParams({
      filename,
      subfolder,
      type: folder_type,
    });

    const response = await fetch(`${this.baseUrl}/view?${data.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to get image: ${response.statusText}`);
    }

    return response.blob();
  }

  private buildBody(input: WorkflowInput, api: Record<string, unknown>) {
    // This is super important and nowhere documented in ComfyUI :(
    // Without this you won't see all the websocket events...
    const clientId = Metadata.clientId;

    const base = {
      prompt: api,
      prompt_id: input.id,
      client_id: clientId,
    };

    if (input.kind === "text-to-image") {
      return JSON.stringify(base);
    }

    if (input.kind === "image-to-video") {
      const workflow = wan2_2_img2vidWorkflow;
      // workflow["93"].inputs.text = input.prompt;
      // workflow["97"].inputs.image = input.imagePath;

      return JSON.stringify({
        ...base,
        extra_data: {
          extra_pnginfo: workflow,
        },
      });
    }
  }

  private buildApi(input: WorkflowInput): Record<string, unknown> {
    let api;

    if (input.kind === "image-to-video") {
      api = wan2_2_img2vidApi;
      api["93"].inputs.text = input.prompt;
      api["97"].inputs.image = input.imagePath;
    }

    if (input.kind === "text-to-image") {
      api = zImageTurboApi;
      api["57:27"].inputs.text = input.prompt;
    }

    return api;
  }

  private async prepareInput(input: WorkflowInput) {
    if (input.kind === "text-to-image") return;

    if (input.kind === "image-to-video") {
      const src = `${OUTPUT_DIR}/${input.imagePath}`.replace('"', "").trim();
      const dst = `${INPUT_DIR}/${input.imagePath}`.replace('"', "").trim();

      const image = await Bun.file(src).arrayBuffer();
      await Bun.write(dst, image);
    }
  }
}

export const comfyClient = new ComfyUIClient({
  baseUrl: COMFYUI_BASE_URL,
});
