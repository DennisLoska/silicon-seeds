import EventEmitter from "node:events";

type TextPromptEvent = {
  id: string;
  prompt: string;
  type: Event.NewTextPrompt;
};

type ImageEvent = { type: Event.NewImage };

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

export type Events = (TextPromptEvent | ImageEvent | ImagePromptEvent)[];

export namespace Event {
  const events = new EventEmitter();

  export function on(event: Event, callback: (...args: Events) => void) {
    events.on(event, callback);
  }

  export function emit(event: Event, ...payload: Events) {
    if (payload) events.emit(event, ...payload);
    else events.emit(event);
  }

  on(Event.NewTextPrompt, (event) => {
    // console.log(event);
  });

  on(Event.NewImagePrompt, (event) => {
    // console.log(event);
  });

  on(Event.NewImage, (event) => {
    // console.log(event);
  });
}
