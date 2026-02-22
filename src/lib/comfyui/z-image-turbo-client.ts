import workflowTemplate from "../workflows/image_z_image_turbo_12_steps_720p.json";

export interface ImageResult {
  url: string;
  buffer?: Buffer;
}

export interface ZImageTurboInput {
  prompt: string;
}

export class ZImageTurboClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: ZImageTurboInput): Promise<ImageResult[]> {
    const workflow = this.buildWorkflow(input);

    try {
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: workflow }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new ZImageTurboError(
          `Z-Image-Turbo request failed with status ${response.status}: ${errorText}`,
          response.status,
          errorText,
        );
      }

      const json = await response.json();
      return json;
    } catch (error) {
      if (error instanceof ZImageTurboError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ZImageTurboError(
        `Connection failed: ${errorMessage}`,
        0,
        errorMessage,
      );
    }
  }

  private buildWorkflow(input: ZImageTurboInput): Record<string, any> {
    const workflow = { ...workflowTemplate };

    workflow["57:27"].inputs.text = input.prompt;

    return workflow;
  }
}

export class ZImageTurboError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "ZImageTurboError";
  }
}
