import EventEmitter from "node:events";

type PromptEvent = {
  id: string;
  prompt: string;
};

type ImageEvent = void;

export enum Event {
  NewImagePrompt = "new_image_prompt",
  NewImage = "new_image",
}

export type Events = (PromptEvent | ImageEvent)[];

export namespace Event {
  const events = new EventEmitter();

  export function on(event: Event, callback: (...args: Events) => void) {
    events.on(event, callback);
  }

  export function emit(event: Event, ...payload: Events) {
    if (payload) events.emit(event, ...payload);
    else events.emit(event);
  }

  on(Event.NewImagePrompt, (event) => {
    console.log(event);
  });
}
