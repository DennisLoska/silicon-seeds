import zImageTurboWorkflow from "./workflows/image_z_image_turbo_12_steps_720p.json";
import i2vWorkflow from "./workflows/video_wan2_2_14B_i2v_720p_5s.json";

type Text2ImgInput = {
  kind: "text-to-image";
  prompt: string;
};
type Img2VidInput = {
  kind: "image-to-video";
  imagePath: string;
  prompt: string;
};

export type WorkflowInput = Text2ImgInput | Img2VidInput;

export class ComfyUIClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: Text2ImgInput | Img2VidInput) {
    const workflow = this.buildWorkflow(input);

    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: workflow }),
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

  private buildWorkflow(input: WorkflowInput): Record<string, any> {
    let workflow;

    if (input.kind === "image-to-video") {
      workflow = i2vWorkflow;
      workflow["93"].inputs.text = input.prompt;
      workflow["97"].inputs.image = input.imagePath;
    }

    if (input.kind === "text-to-image") {
      workflow = zImageTurboWorkflow;
      workflow["57:27"].inputs.text = input.prompt;
    }

    return workflow;
  }
}

export const comfyClient = new ComfyUIClient({
  baseUrl: "http://127.0.0.1:8188",
});
