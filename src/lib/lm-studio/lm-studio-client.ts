export interface LmStudioConfig {
  baseUrl: string;
  model: string;
  maxTokens?: number;
  imageFormat?: "base64-dataurl";
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type MessageContent = TextContent | ImageContent;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | MessageContent[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  response_format?: { type: "json_schema" | "text" };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageInput {
  base64: string;
  format: "png" | "jpeg" | "gif" | "webp";
}

export class LmStudioClient {
  private config: LmStudioConfig;

  constructor(
    config: Partial<LmStudioConfig> & Pick<LmStudioConfig, "baseUrl" | "model">,
  ) {
    this.config = {
      maxTokens: 2048,
      imageFormat: "base64-dataurl",
      ...config,
    };
  }

  private base64ToDataUrl(
    base64: string,
    format: ImageInput["format"],
  ): string {
    return `data:image/${format};base64,${base64}`;
  }

  async chat(
    prompt: string,
    options?: {
      systemPrompt?: string;
      image?: ImageInput;
      responseFormat?: "json_schema" | "text";
      maxTokens?: number;
    },
  ): Promise<ChatCompletionResponse> {
    const messages: ChatMessage[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    let content: string | MessageContent[];

    if (options?.image) {
      content = [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: this.base64ToDataUrl(
              options.image.base64,
              options.image.format,
            ),
          },
        },
      ];
    } else {
      content = prompt;
    }

    messages.push({ role: "user", content });

    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      response_format: options?.responseFormat
        ? { type: options.responseFormat }
        : undefined,
    };

    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new LmStudioError(
          `LM Studio request failed with status ${response.status}: ${errorText}`,
          response.status,
          errorText,
        );
      }

      let jsonData: ChatCompletionResponse;
      try {
        jsonData = (await response.json()) as ChatCompletionResponse;
      } catch (parseError) {
        const responseText = await response.text();
        throw new LmStudioError(
          `Failed to parse LM Studio response as JSON: ${responseText}`,
          response.status,
          responseText,
        );
      }

      return jsonData;
    } catch (error) {
      if (error instanceof LmStudioError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new LmStudioError(
        `Connection failed: ${errorMessage}`,
        0,
        errorMessage,
      );
    }
  }

  async getChatCompletionText(
    response: ChatCompletionResponse,
  ): Promise<string> {
    if (response.choices.length === 0) {
      throw new LmStudioError("No choices in response", 0, "");
    }
    const message = response.choices[0].message;
    return typeof message.content === "string" ? message.content : "";
  }

  async chatWithTextResponse(
    prompt: string,
    options?: {
      systemPrompt?: string;
      image?: ImageInput;
      maxTokens?: number;
    },
  ): Promise<string> {
    const response = await this.chat(prompt, {
      ...options,
      responseFormat: "text",
    });
    return this.getChatCompletionText(response);
  }
}

export class LmStudioError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "LmStudioError";
  }
}

