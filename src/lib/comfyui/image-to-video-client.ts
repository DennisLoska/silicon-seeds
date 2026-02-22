import workflowTemplate from "../workflows/video_wan2_2_14B_i2v_720p_5s.json";

export interface VideoInput {
  imagePath: string;
  prompt: string;
}

export interface VideoResult {
  url: string;
  buffer?: Buffer;
}

export class VideoClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: VideoInput): Promise<VideoResult[]> {
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
        throw new VideoError(
          `Video request failed with status ${response.status}: ${errorText}`,
          response.status,
          errorText,
        );
      }

      const json = await response.json();
      return json;
    } catch (error) {
      if (error instanceof VideoError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new VideoError(
        `Connection failed: ${errorMessage}`,
        0,
        errorMessage,
      );
    }
  }

  private buildWorkflow(input: VideoInput): Record<string, any> {
    const workflow = { ...workflowTemplate };

    // Override node 97 (LoadImage) with input image path
    workflow["97"].inputs.image = input.imagePath;

    // Override node 93 (CLIPTextEncode positive) with input prompt
    workflow["93"].inputs.text = input.prompt;

    return workflow;
  }
}

export class VideoError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "VideoError";
  }
}
