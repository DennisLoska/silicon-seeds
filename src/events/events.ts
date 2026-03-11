import EventEmitter from "node:events";

export enum JobMode {
  Text = "text",
  Image = "image",
  Video = "video",
  Speech = "speech",
  Instrumental = "instrumental",
}

interface BaseEvent {
  id: string;
}

interface JobBaseEvent extends BaseEvent {
  jobId: string;
  mode: JobMode;
}

export enum Event {
  NewImagePrompt = "new_image_prompt",
  NewVideoPrompt = "new_video_prompt",
  NewAudioPrompt = "new_audio_prompt",
  ComfyExecuted = "comfy_executed",
}

export interface ImagePromptEvent extends JobBaseEvent {
  prompt: string;
  type: Event.NewImagePrompt;
}

export interface AudioPromptEvent extends JobBaseEvent {
  prompt?: string;
  duration?: number;
  type: Event.NewAudioPrompt;
}

export interface VideoPromptEvent extends JobBaseEvent {
  id: string;
  jobId: string;
  prompt: string;
  type: Event.NewVideoPrompt;
  filename: string;
}

export interface ComfyExecutedEvent extends BaseEvent {
  data: Record<string, unknown>;
}

type EventMap = {
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewVideoPrompt]: VideoPromptEvent;
  [Event.NewAudioPrompt]: AudioPromptEvent;
  [Event.ComfyExecuted]: ComfyExecutedEvent;
};

export type Events = EventMap[keyof EventMap][];

type JobMap = Omit<EventMap, Event.ComfyExecuted>;
export type JobEvents = JobMap[keyof JobMap][];
export type JobEvent = JobEvents[number];

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
    logEvent(event);
  });

  on(Event.NewVideoPrompt, (event) => {
    logEvent(event);
  });

  on(Event.NewAudioPrompt, (event) => {
    logEvent(event);
  });

  function logEvent(event: JobEvent) {
    console.log("");
    console.log(`===========${event.mode}=============`);
    console.log("");
    console.log(event);
    console.log("");
  }
}
