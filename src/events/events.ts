import EventEmitter from "node:events";

export enum JobMode {
  Text = "text",
  Image = "image",
  Video = "video",
  Audio = "audio",
}

interface BaseEvent {
  id: string;
  jobId: string;
  mode: JobMode;
}

export enum Event {
  NewImagePrompt = "new_image_prompt",
  NewVideoPrompt = "new_video_prompt",
  NewAudioPrompt = "new_audio_prompt",
}

export interface ImagePromptEvent extends BaseEvent {
  prompt: string;
  type: Event.NewImagePrompt;
}

export interface AudioPromptEvent extends BaseEvent {
  prompt: string;
  type: Event.NewAudioPrompt;
}

export interface VideoPromptEvent extends BaseEvent {
  id: string;
  jobId: string;
  prompt: string;
  type: Event.NewVideoPrompt;
  filename: string;
}

type EventMap = {
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewVideoPrompt]: VideoPromptEvent;
  [Event.NewAudioPrompt]: AudioPromptEvent;
};

export type Events = EventMap[keyof EventMap][];
export type JobEvent = Events[number];

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
