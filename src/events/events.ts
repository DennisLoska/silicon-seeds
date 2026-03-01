import EventEmitter from "node:events";

type TextPromptEvent = {
  id: string;
  jobId: string;
  prompt: string;
  type: Event.NewTextPrompt;
};

type ImageEvent = { id: string; jobId: string; type: Event.NewImage };

type ImagePromptEvent = {
  filename: string;
  subfolder: string;
  kind: "input" | "output" | "temp";
  type: Event.NewImagePrompt;
};

export enum Event {
  NewTextPrompt = "new_text_prompt",
  NewImagePrompt = "new_image_prompt",
  NewImage = "new_image",
}

type EventMap = {
  [Event.NewTextPrompt]: TextPromptEvent;
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewImage]: ImageEvent;
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

  on(Event.NewImage, () => {
    console.log("");
    console.log("========================");
    console.log("event:", Event.NewImage);
  });
}
