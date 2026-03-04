import EventEmitter from "node:events";

export enum JobMode {
  Text = "text",
  Image = "image",
  Video = "video",
}

interface BaseEvent {
  id: string;
  jobId: string;
  mode: JobMode;
}

export interface TextPromptEvent extends BaseEvent {
  prompt: string;
  type: Event.NewTextPrompt;
}

interface ImagePromptEvent extends BaseEvent {
  filename: string;
  subfolder: string;
  kind: "input" | "output" | "temp";
  type: Event.NewImagePrompt;
}

interface VideoPromptEvent extends BaseEvent {
  id: string;
  jobId: string;
  prompt: string;
  type: Event.NewVideoPrompt;
  filename: string;
}

export enum Event {
  NewTextPrompt = "new_text_prompt",
  NewImagePrompt = "new_image_prompt",
  NewVideoPrompt = "new_video_prompt",
}

type EventMap = {
  [Event.NewTextPrompt]: TextPromptEvent;
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewVideoPrompt]: VideoPromptEvent;
};

export type Events = EventMap[keyof EventMap][];

export namespace Event {
  const events = new EventEmitter();

  export function on<K extends keyof EventMap>(
    event: K,
    callback: (...args: [EventMap[K]]) => void,
  ) {
    events.on(event, callback);
  }

  export function emit<K extends keyof EventMap>(
    event: K,
    ...payload: [EventMap[K]]
  ): void;
  export function emit<K extends keyof EventMap>(event: K): void;
  export function emit<K extends keyof EventMap>(
    event: K,
    ...payload: unknown[]
  ): void {
    if (payload) events.emit(event, ...payload);
    else events.emit(event);
  }

  on(Event.NewTextPrompt, (event) => {
    console.log("");
    console.log("========================");
    console.log("Event:", Event.NewTextPrompt);
    console.log(event);
  });

  on(Event.NewImagePrompt, (event) => {
    console.log("");
    console.log("========================");
    console.log("Event:", Event.NewImagePrompt);
    console.log(event);
  });

  on(Event.NewVideoPrompt, (event) => {
    console.log("");
    console.log("========================");
    console.log("Event:", Event.NewVideoPrompt);
    console.log(event);
  });
}
