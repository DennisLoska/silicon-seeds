import EventEmitter from "node:events";
import { Logger } from "../logger/logger";
import { Lora } from "../styles/presets";

export enum JobMode {
  Text = "text",
  Image = "image",
  Video = "video",
  Speech = "speech",
  Instrumental = "instrumental",
}

export enum JobStatus {
  Pending = "pending",
  Complete = "complete",
}

interface BaseEvent {
  id: string;
  created_at?: string;
}

export interface JobBaseEvent extends BaseEvent {
  jobId: string;
  mode: JobMode;
  status: JobStatus;
  meta?: Record<string, unknown>;
}

export enum Event {
  NewImagePrompt = "new_image_prompt",
  NewVideoPrompt = "new_video_prompt",
  NewTransitionPrompt = "new_transition_prompt",
  NewAudioPrompt = "new_audio_prompt",
  ComfyExecuted = "comfy_executed",
}

export interface ImagePromptEvent extends JobBaseEvent {
  prompt: string;
  type: Event.NewImagePrompt;
  lora?: Lora;
  index?: number;
}

export interface VideoPromptEvent extends JobBaseEvent {
  prompt: string;
  type: Event.NewVideoPrompt;
  filename: string;
  index?: number;
}

export interface TransitionPromptEvent extends JobBaseEvent {
  prompt: string;
  type: Event.NewTransitionPrompt;
  startImg: string;
  endImg: string;
  index?: number;
}

export interface AudioPromptEvent extends JobBaseEvent {
  prompt: string | null;
  duration?: number;
  type: Event.NewAudioPrompt;
}

export interface ComfyExecutedEvent extends BaseEvent {
  data: Record<string, unknown>;
}

type EventMap = {
  [Event.NewImagePrompt]: ImagePromptEvent;
  [Event.NewVideoPrompt]: VideoPromptEvent;
  [Event.NewTransitionPrompt]: TransitionPromptEvent;
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
    Logger.info(`===========mode:${event.mode}=============`, event);
  }
}
