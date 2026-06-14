import { DB } from "../../db/db";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";
import { text_to_script } from "./text-to-script";

export async function script_to_scenes() {
  // TODO get these from query parameters
  // const script = "A sermon about the parable of the Sower.";

  const { id: jobId } = await JobOrchestrator.create_job({});

  const list = [
    "The Power of Faith: Trusting God in Uncertain Times",
    "Love Your Neighbor: A Call to Compassion",
    "Grace and Mercy: Understanding God's Unmerited Favor",
    "The Parable of the Prodigal Son: A Story of Redemption",
    "Walking in the Spirit: Living a Life Filled with God's Presence",
    "The Beatitudes: Blessings for the Humble and Righteous",
    "Faith in Action: How Belief Transforms Lives",
    "Overcoming Fear: Trusting God in the Face of Adversity",
    "The Greatest Commandment: Love God and Love Others",
    "From Death to Life: The Resurrection and Eternal Hope",
  ];

  for (const prompt of list) {
    // TODO pass as post body instead
    const res = await text_to_script(prompt);
    const json = await res.json();
    const script = json.message;

    if (!script) {
      await DB.Jobs.failJob(jobId);
      return new Response(JSON.stringify({ message: "Oh no" }), {
        status: 500,
      });
    }

    const scenes = await PromptGenerator.image_scene_prompts(script, 40);

    if (!scenes) {
      await DB.Jobs.failJob(jobId);
      return new Response(JSON.stringify({ message: "Failed to generate scenes" }), {
        status: 500,
      });
    }

    for (const scene of scenes) {
      const scheduled = await PromptGenerator.styled_img_to_event(
        jobId,
        JobMode.Video,
        scene,
        Presets.WATERCOLOR,
      );

      if (!scheduled) {
        await DB.Jobs.failJob(jobId);
        return new Response(JSON.stringify({ message: "Failed to schedule scene event" }), {
          status: 500,
        });
      }
    }
  }

  return new Response(JSON.stringify({ message: "job queued" }));
}
