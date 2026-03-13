import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobMode } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";

export namespace VideoGenerator {
  export function init() {
    Event.on(Event.NewVideoPrompt, (event) => {
      QueueManager.videoQueue.push(event);
      generate_video();
    });
    Event.on(Event.NewTransitionPrompt, (event) => {
      QueueManager.videoQueue.push(event);
      generate_video();
    });
    Event.on(Event.ComfyExecuted, (event) => {
      // TODO: define and schedule video transitions
      // - check if all videos are there
      // - if yes then get all videos from the job orchestrator
      // - extract first/last frame
      // - schedule all transitions
      // - mark job as complete (optional)
      console.log("TODO schedule transitions here", event);
      JobOrchestrator.schedule_task({});
    });
  }

  export function schedule_video(event: {
    jobId: string;
    prompt: string;
    filename: string;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewVideoPrompt,
      mode: JobMode.Video,
    });
  }

  export function schedule_transition(event: {
    jobId: string;
    prompt: string;
    startImg: string;
    endImg: string;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewTransitionPrompt,
      mode: JobMode.Video,
    });
  }

  export function generate_video() {
    if (QueueManager.isVideoQueueBlocked()) return;

    const item = QueueManager.pop("video");
    assert(
      item.type === Event.NewVideoPrompt ||
        item.type === Event.NewTransitionPrompt,
      "Incorrect event type!",
    );

    const { id, prompt } = item;

    if (item.type === Event.NewTransitionPrompt) {
      void comfyClient.generate({
        id,
        kind: "image-to-transition",
        prompt,
        startImage: item.startImg,
        endImage: item.endImg,
      });
    }

    if (item.type === Event.NewVideoPrompt) {
      void comfyClient.generate({
        id,
        kind: "image-to-video",
        prompt,
        imagePath: item.filename,
      });
    }
  }
}
