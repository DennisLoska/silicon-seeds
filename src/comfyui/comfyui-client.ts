import { Metadata } from "../meta/meta";
import zImageTurboApi from "./api/image_z_image_turbo_720p.json";
import zImageTurboWithLoraApi from "./api/image_z_image_turbo_lora_720p.json";
import wan2_2_img2vidApi from "./api/video_wan2_2_14B_i2v_720p_5s.json";
import wan2_2_img2transitionApi from "./api/video_wan2_2_14B_transitions.json";
import ltx2_3_img2vidApi from "./api/video_ltx2_3_i2v.json";
import ltx2_3_img2transitionApi from "./api/video_ltx2_3_style_transition.json";
import ace_step_1_0_api from "./api/audio_ace_step_1_0_instrumental.json";
import kokoro_tts_api from "./api/kokoro-tts.json";
import wan2_2_img2vidWorkflow from "./workflows/video_wan2_2_14B_i2v_720p_5s.json";
import wan2_2_img2transWorkflow from "./workflows/video_wan2_2_14B_transitions.json";
import ltx2_3_img2vidWorkflow from "./workflows/video_ltx2_3_i2v.json";
import ltx2_3_img2transWorkflow from "./workflows/video_ltx2_3_style_transition.json";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { Lora } from "../styles/presets";
import { JobsSchema } from "../db/db";

type Text2ImgInput = {
  id: string;
  kind: "text-to-image";
  prompt: string;
  lora?: Lora;
};

type Img2VidInput = {
  id: string;
  kind: "image-to-video";
  imagePath: string;
  prompt: string;
};

type Text2SpeechInput = {
  id: string;
  kind: "text-to-speech";
  prompt: string;
};

type Text2Instrumental = {
  id: string;
  kind: "text-to-instrumental";
  prompt: string | null;
  duration: number;
};

type Img2Transition = {
  id: string;
  kind: "image-to-transition";
  startImage: string;
  endImage: string;
  prompt: string;
};

export type ModelVariant =
  | Text2ImgInput
  | Img2VidInput
  | Text2SpeechInput
  | Text2Instrumental
  | Img2Transition;

const OUTPUT_DIR = Bun.env.OUTPUT_DIR;
const INPUT_DIR = Bun.env.INPUT_DIR;
const COMFYUI_BASE_URL = Bun.env.COMFYUI_BASE_URL;

Utils.assert(
  OUTPUT_DIR && INPUT_DIR && COMFYUI_BASE_URL,
  "ComfyUI env. variables not configured!",
);

export class ComfyUIClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: ModelVariant, job: JobsSchema) {
    const api = this.buildApi(input, job);
    const body = this.buildBody(input, api, job);

    await this.prepareInput(input);

    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to generate content: ${response.body}`);
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

  async deleteQueuedPrompts(promptIds: string[]): Promise<boolean> {
    if (promptIds.length === 0) return true;

    const response = await fetch(`${this.baseUrl}/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delete: promptIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete queued prompts: ${response.statusText}`);
    }

    return true;
  }

  async interruptPrompt(promptId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/interrupt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt_id: promptId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to interrupt prompt: ${response.statusText}`);
    }

    return true;
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
    Utils.assert(
      outputs.length === 1,
      `ComfyUI job should have exactly one item in history, found: ${JSON.stringify(outputs)}`,
    );

    const [output] = outputs as any;
    const [image] = output.images;
    Utils.assert(
      image.subfolder === "",
      `Expected 'subfolder' to be "" (empty), but found '${image.subfolder}'`,
    );

    images.push({
      filename: image.filename,
      subfolder: image.subfolder,
      kind: image.type,
    });

    Utils.assert(
      images.length === 1,
      "There should be only one image per ComfyUI job",
    );

    return images[0];
  }

  async getAsset(
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

  async free_memory(
    unloadModels: boolean,
    freeMemory: boolean,
  ): Promise<boolean> {
    const payload = { unload_models: unloadModels, free_memory: freeMemory };

    try {
      const res = await fetch(`${this.baseUrl}/free`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        Logger.warn(`Freeing memory failed`);
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(`Freeing memory failed`);
      return false;
    }
  }

  private buildBody(
    input: ModelVariant,
    api: Record<string, unknown>,
    job: JobsSchema,
  ) {
    // This is super important and nowhere documented in ComfyUI :(
    // Without this you won't see all the websocket events...
    const clientId = Metadata.clientId;
    const base = {
      prompt: api,
      prompt_id: input.id,
      client_id: clientId,
    };

    let workflow;
    if (input.kind === "image-to-video") {
      if (job.video_model === "wan2.2") {
        workflow = wan2_2_img2vidWorkflow;
      }

      if (job.video_model === "ltx2.3") {
        workflow = ltx2_3_img2vidWorkflow;
      }

      return JSON.stringify({
        ...base,
        extra_data: {
          extra_pnginfo: workflow,
        },
      });
    } else if (input.kind === "image-to-transition") {
      // TODO expose transition model in UI
      if (job.video_model === "wan2.2") {
        workflow = wan2_2_img2transWorkflow;
      }
      if (job.video_model === "ltx2.3") {
        workflow = ltx2_3_img2transWorkflow;
      }

      return JSON.stringify({
        ...base,
        extra_data: {
          extra_pnginfo: workflow,
        },
      });
    } else {
      return JSON.stringify(base);
    }
  }

  private buildApi(
    input: ModelVariant,
    job: JobsSchema,
  ): Record<string, unknown> {
    // Better to raw dog the exported json workflows
    let api;

    let resolution = { width: 0, height: 0 };
    if (job.resolution === "480p") {
      ((resolution.width = 640), (resolution.height = 480));
    }

    if (job.resolution === "720p") {
      ((resolution.width = 1280), (resolution.height = 720));
    }

    if (job.resolution === "1080p") {
      ((resolution.width = 1920), (resolution.height = 1080));
    }

    if (job.resolution === "9_16_SD") {
      ((resolution.width = 720), (resolution.height = 1280));
    }

    if (job.resolution === "9_16_HD") {
      ((resolution.width = 1080), (resolution.height = 1920));
    }

    if (input.kind === "text-to-image") {
      // TODO replace or keep?
      // api = zImageTurboApi;
      // api["9"].inputs.filename_prefix = input.id;
      // api["57:27"].inputs.text = input.prompt;
      // baby seed: 189246353926834
      // api["57:3"].inputs.seed = Math.floor(Math.random() * 100_000_000_000_000);

      if (job.image_model === "z-image-turbo") {
        api = zImageTurboWithLoraApi;
        api["9"].inputs.filename_prefix = input.id;
        api["41"].inputs.width = resolution.width;
        api["41"].inputs.height = resolution.height;
        api["45"].inputs.text = input.prompt;
        api["44"].inputs.seed = Math.floor(Math.random() * 100_000_000_000_000);
        api["51"].inputs.strength_model = 0.7;

        if (input.lora) {
          api["51"].inputs.lora_name = `${input.lora}.safetensors`;
        }
      }
    }

    if (input.kind === "image-to-video") {
      if (job.video_model === "wan2.2") {
        api = wan2_2_img2vidApi;
        api["93"].inputs.text = input.prompt;
        api["98"].inputs.width = resolution.width;
        api["98"].inputs.height = resolution.height;
        api["98"].inputs.length =
          (job.clip_duration || Metadata.CLIP_DURATION) *
            (job.fps || Metadata.FPS) +
          1;
        api["108"].inputs.filename_prefix = input.id;
        api["97"].inputs.image = input.imagePath;
      }

      if (job.video_model === "ltx2.3") {
        api = ltx2_3_img2vidApi;
        api["267:266"].inputs.value = input.prompt;
        api["267:257"].inputs.value = resolution.width;
        api["267:258"].inputs.value = resolution.height;
        api["267:225"].inputs.value =
          (job.clip_duration || Metadata.CLIP_DURATION) *
            (job.fps || Metadata.FPS) +
          1;
        api["75"].inputs.filename_prefix = input.id;
        api["269"].inputs.image = input.imagePath;
      }
    }

    if (input.kind === "text-to-speech") {
      api = kokoro_tts_api;
      api["4"].inputs.filename_prefix = input.id;
      api["2"].inputs.text = input.prompt;
      // TODO add parameters for: speed, speaker_name
    }

    if (input.kind === "text-to-instrumental") {
      api = ace_step_1_0_api;

      if (input.prompt) {
        api["14"].inputs.tags = input.prompt;
      }
      api["59"].inputs.filename_prefix = input.id;
      api["17"].inputs.seconds = input.duration;
    }

    if (input.kind === "image-to-transition") {
      if (job.video_model === "wan2.2") {
        api = wan2_2_img2transitionApi;
        api["6"].inputs.text = input.prompt;
        api["68"].inputs.image = input.startImage;
        api["67"].inputs.width = resolution.width;
        api["67"].inputs.height = resolution.height;
        api["67"].inputs.length =
          (job.transition_duration || Metadata.TRANSITION_DURATION) *
            (job.fps || Metadata.FPS) +
          1;
        api["62"].inputs.image = input.endImage;
        api["61"].inputs.filename_prefix = input.id;
      }

      if (job.video_model === "ltx2.3") {
        api = ltx2_3_img2transitionApi;
        api["139:128"].inputs.text = input.prompt;
        api["137"].inputs.image = input.startImage;
        api["139:113"].inputs.value = resolution.width;
        api["139:98"].inputs.value = resolution.height;
        api["139:114"].inputs.value = job.fps || Metadata.FPS;
        api["139:143"].inputs.value =
          job.transition_duration || Metadata.TRANSITION_DURATION;
        api["138"].inputs.image = input.endImage;
        api["68"].inputs.filename_prefix = input.id;
      }
    }

    Utils.assert(
      api,
      `ComfyUI workflow does not exist for event kind: ${input.kind}`,
    );

    return api;
  }

  private async prepareInput(input: ModelVariant) {
    if (input.kind !== "image-to-video") return;

    const src = `${OUTPUT_DIR}/${input.imagePath}`.replace('"', "").trim();
    const dst = `${INPUT_DIR}/${input.imagePath}`.replace('"', "").trim();

    const image = await Bun.file(src).arrayBuffer();
    await Bun.write(dst, image);
  }
}

export const comfyClient = new ComfyUIClient({
  baseUrl: COMFYUI_BASE_URL,
});
