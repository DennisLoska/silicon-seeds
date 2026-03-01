import EventEmitter from "node:events";

interface BaseEvent {
  id: string;
  jobId: string;
}

interface TextPromptEvent extends BaseEvent {
  prompt: string;
  type: Event.NewTextPrompt;
}

interface TextEvent extends BaseEvent {
  text: string;
  type: Event.NewText;
}

interface ImagePromptEvent extends BaseEvent {
  filename: string;
  subfolder: string;
  kind: "input" | "output" | "temp";
  type: Event.NewImagePrompt;
}

interface ImageEvent extends BaseEvent {
  id: string;
  jobId: string;
  type: Event.NewImage;
}

interface VideoPromptEvent extends BaseEvent {
  id: string;
  jobId: string;
  prompt: string;
  type: Event.NewVideoPrompt;
  filename: string;
}

interface VideoEvent extends BaseEvent {
  id: string;
  jobId: string;
  type: Event.NewVideo;
}

export enum Event {
  NewTextPrompt = "new_text_prompt",
  NewImagePrompt = "new_image_prompt",
  NewText = "new_text",
  NewImage = "new_image",
  NewVideoPrompt = "new_video_prompt",
  NewVideo = "new_video",
}

type EventMap = {
  [Event.NewTextPrompt]: TextPromptEvent;
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewText]: TextEvent;
  [Event.NewImage]: ImageEvent;
  [Event.NewVideoPrompt]: VideoPromptEvent;
  [Event.NewVideo]: VideoEvent;
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
    console.log("event:", Event.NewTextPrompt);
    console.log(event);
  });

  on(Event.NewImagePrompt, (event) => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewImagePrompt);
    console.log(event);
  });

  on(Event.NewVideoPrompt, (event) => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewVideoPrompt);
    console.log(event);
  });

  on(Event.NewText, () => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewText);
  });

  on(Event.NewImage, () => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewImage);
  });

  on(Event.NewVideo, () => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewVideo);
  });
}
