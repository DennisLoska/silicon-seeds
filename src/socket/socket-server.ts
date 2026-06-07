import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import { VideoGenerator } from "../video/video-generator";
import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobMode, JobStatus } from "../events/events";
import { JobLifecycleStatus } from "../events/events";
import { AudioGenerator } from "../audio/audio-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";
import { AutoCutWorkflow } from "../autocut/autocut-workflow";
import { Lora, Presets } from "../styles/presets";
import { ImageGenerator } from "../image/image-generator";
import { JobContentArea } from "../templates/jobs";

export namespace SocketServer {
  let ws: WebSocket;
  const COMFY_BINARY_TEXT_EVENT = 3;

  export async function start() {
    ws = new WebSocket(
      `${Bun.env.COMFYUI_BASE_WS}/ws?clientId=${Metadata.clientId}`,
    );

    ws.addEventListener("message", message);
    ws.addEventListener("error", error);
    ws.addEventListener("open", open);
    ws.addEventListener("close", close);

    await comfyClient.free_memory(true, true);
  }

  export function stop() {
    ws.close();
  }

  async function message(event: MessageEvent) {
    if (typeof event.data !== "string") {
      await handle_binary_message(event.data);
      return;
    }

    Logger.debug("MESSAGE", event.data);
    const msg = JSON.parse(event.data);

    if (msg.type === "progress") {
      Logger.info(`Progress: ${msg.data.value}/${msg.data.max}`);
    }

    if (msg.type === "status") {
      QueueManager.comfyQueue = msg.data?.status?.exec_info?.queue_remaining;
      Logger.info(`Jobs in ComfyUI queue: ${QueueManager.comfyQueue}`);
    }

    if (msg.type === "executed") {
      Logger.info("===executed===", msg.data);

      // Can be used to enrich REST api responses
      // Can be used to enrich job events
      Event.emit(Event.ComfyExecuted, {
        id: msg.data.prompt_id,
        created_at: new Date().toISOString(),
        data: msg.data.output,
      });
    }

    if (msg.type === "execution_success") {
      Logger.info("===execution_success===");
      const { prompt_id: promptId } = msg.data;

      const event = await DB.Events.findById(promptId);
      Utils.assert(event, "Event is missing");

      const job = await DB.Jobs.findById(event.jobId);

      await comfyClient.free_memory(true, true);
      QueueManager.releaseComfyIdle();

      if (
        event.status !== JobStatus.Running ||
        job.status !== JobLifecycleStatus.Active
      ) {
        await DB.Jobs.finalizeCompletedJobs();
        void QueueManager.pump();
        return;
      }

      const deferCompletion =
        (event.type === Event.NewImagePrompt && event.mode === JobMode.Video) ||
        (event.type === Event.NewAudioPrompt && event.mode === JobMode.Speech);

      if (!deferCompletion) {
        await JobOrchestrator.update_schedule({
          ...event,
          status: JobStatus.Complete,
        });
      }

      if (event.type === Event.NewImagePrompt && event.mode === JobMode.Video) {
        const scheduledVideo =
          await PromptGenerator.img_to_vid_prompt(promptId);

        const jobForImage = await DB.Jobs.findById(event.jobId);
        if (scheduledVideo && jobForImage.workflow === "autocut") {
          await AutoCutWorkflow.registerGeneratedVideoEvent(
            event.jobId,
            event.id,
            scheduledVideo.id,
          );
        }
      }

      if (
        event.type === Event.NewAudioPrompt &&
        event.mode === JobMode.Speech
      ) {
        // Extract duration and clip count to schedule instrumental generation and prompts for video scenes
        const { duration, clipCount } =
          await AudioGenerator.handle_tts_complete(event);

        // Schedule instrumental generation to overlap with video generation and editing
        await AudioGenerator.schedule_audio({
          jobId: event.jobId,
          duration,
          mode: JobMode.Instrumental,
        });

        // Schedule prompts for video scenes
        const textEvents = (await DB.Events.findByJobId(event.jobId)).filter(
          (item) => item.type === Event.NewTextPrompt,
        );
        const scriptEvent = textEvents[0];

        if (scriptEvent?.type === Event.NewTextPrompt) {
          const scenes = await PromptGenerator.image_scene_prompts(
            scriptEvent.text,
            clipCount,
          );
          if (scenes) {
            const styledImgPrompts = await Promise.all(
              scenes.map(async (scene, index) => {
                const res = await PromptGenerator.txt_to_img_prompt(
                  scene,
                  1,
                  job.style_preset as Presets | undefined,
                );
                if (!res) return null;
                const [item] = res;

                return { prompt: item?.prompt, lora: item?.lora, index };
              }),
            );

            Logger.info("Generated styled image prompts:", styledImgPrompts);
            Utils.assert(
              styledImgPrompts.every((item) => Boolean(item?.prompt)),
              "One or more scene prompts not defined",
            );

            await Promise.all(
              styledImgPrompts.map(async (item) => {
                await ImageGenerator.schedule_image({
                  jobId: event.jobId,
                  mode: JobMode.Video,
                  prompt: item?.prompt as unknown as string,
                  lora: item?.lora as unknown as Lora | undefined,
                  index: item?.index,
                });
              }),
            );
          }
        }
      }

      if (deferCompletion) {
        await JobOrchestrator.update_schedule({
          ...event,
          status: JobStatus.Complete,
        });
      }

      if (
        event.type === Event.NewVideoPrompt ||
        event.type === Event.NewTransitionPrompt
      ) {
        Logger.info("Saving video or transition to /tmp");

        try {
          const metadata = await DB.Meta.findByEventId(event.id);
          const videoBlob = await comfyClient.getAsset(
            metadata.filename,
            metadata.subfolder,
            metadata.type,
          );

          const tmpFile = `/tmp/${event.jobId}_${event.id}.mp4`;
          await Bun.write(tmpFile, await videoBlob.arrayBuffer());
        } catch (error) {
          Logger.error("Failed to create video or transition", error);
        }

        if (await AutoCutWorkflow.shouldHandleVideoEvent(event)) {
          await AutoCutWorkflow.handleVideoAssetSaved(event);
          await DB.Jobs.finalizeCompletedJobs();
          void QueueManager.pump();
          return;
        }
      }

      if (event.type === Event.NewVideoPrompt && event.mode === JobMode.Video) {
        const transitions = await VideoGenerator.prepare_transitions(event);

        if (transitions) {
          for (const transition of transitions) {
            await VideoGenerator.schedule_transition({
              jobId: event.jobId,
              prompt: transition.prompt,
              startImg: transition.first,
              endImg: transition.last,
              index: transition.index,
            });
          }
        }
      }

      if (
        !(
          event.type === Event.NewVideoPrompt ||
          event.type === Event.NewTransitionPrompt
        )
      ) {
        Logger.info("Not a video or transition event");
        await DB.Jobs.finalizeCompletedJobs();
        void QueueManager.pump();
        return;
      }

      const events = await JobOrchestrator.job_events(event.jobId);
      const allComplete = events
        .filter(
          (e) =>
            e.type === Event.NewImagePrompt ||
            e.type === Event.NewVideoPrompt ||
            e.type === Event.NewTransitionPrompt,
        )
        .every((e) => e.status === JobStatus.Complete);

      Logger.info("Job complete?", {
        allComplete,
      });

      if (allComplete) {
        Logger.info(`Triggering video combiner for job ${event.jobId}`);
        void VideoGenerator.combine_outputs(event.jobId);
      }

      await DB.Jobs.finalizeCompletedJobs();

      void QueueManager.pump();
    }

    if (msg.type === "execution_interrupted") {
      Logger.warn("===execution_interrupted===", msg.data);

      const { prompt_id: promptId } = msg.data;

      if (promptId) {
        const event = await DB.Events.findById(promptId).catch(() => null);

        if (event) {
          const job = await DB.Jobs.findById(event.jobId).catch(() => null);

          if (
            job?.status === JobLifecycleStatus.Active &&
            event.status === JobStatus.Running
          ) {
            await DB.Events.markFailed(promptId, "execution interrupted");
            await DB.Jobs.failJob(event.jobId);
          }
        }
      }

      await comfyClient.free_memory(true, true);
      QueueManager.releaseComfyIdle();
      void QueueManager.pump();
    }

    if (msg.type === "execution_error") {
      Logger.error("===execution_error===", msg.data);

      const { prompt_id: promptId, exception_message: exceptionMessage } =
        msg.data;

      if (promptId) {
        const event = await DB.Events.findById(promptId).catch(() => null);

        if (event) {
          const job = await DB.Jobs.findById(event.jobId).catch(() => null);

          if (
            job?.status === JobLifecycleStatus.Active &&
            event.status === JobStatus.Running
          ) {
            await DB.Events.markFailed(
              promptId,
              exceptionMessage ?? "execution error",
            );
            await DB.Jobs.failJob(event.jobId);
          }
        }
      }

      await comfyClient.free_memory(true, true);
      QueueManager.releaseComfyIdle();
      void QueueManager.pump();
    }
  }

  async function handle_binary_message(data: Blob | ArrayBuffer | Uint8Array) {
    const bytes = await to_uint8_array(data);
    if (bytes.byteLength < 4) {
      Logger.warn("Ignoring malformed ComfyUI binary websocket message", {
        size: bytes.byteLength,
      });
      return;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eventType = view.getUint32(0);

    if (eventType === COMFY_BINARY_TEXT_EVENT) {
      Logger.debug("ComfyUI binary text", decode_binary_text(bytes));
      return;
    }

    Logger.debug("Ignoring ComfyUI binary websocket message", {
      eventType,
      size: bytes.byteLength,
    });
  }

  async function to_uint8_array(data: Blob | ArrayBuffer | Uint8Array) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new Uint8Array(await data.arrayBuffer());
  }

  function decode_binary_text(bytes: Uint8Array) {
    const decoder = new TextDecoder();

    if (bytes.byteLength <= 4) return "";

    // ComfyUI binary text frames prepend the event type, and some custom nodes
    // add a length-prefixed node id before the actual message body.
    if (bytes.byteLength > 8) {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const nodeIdLength = view.getUint32(4);

      if (nodeIdLength > 0 && 8 + nodeIdLength <= bytes.byteLength) {
        const node = decoder.decode(bytes.subarray(8, 8 + nodeIdLength));
        const text = decoder.decode(bytes.subarray(8 + nodeIdLength)).trim();

        if (text.length > 0) return `${node} ${text}`;
        return node;
      }
    }

    return decoder.decode(bytes.subarray(4)).trim();
  }

  function error(error: globalThis.Event) {
    Logger.info("Socket error: ", error);
  }

  function open() {
    Logger.info(
      `Socket with client id ${Metadata.clientId} connected to ComfyUI`,
    );
  }

  function close() {
    Logger.info("Connection closed\n");
  }
}
