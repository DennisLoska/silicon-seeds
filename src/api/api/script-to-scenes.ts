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

    if (!script)
      return new Response(JSON.stringify({ message: "Oh no" }), {
        status: 500,
      });

    void PromptGenerator.image_scene_prompts(
      jobId,
      JobMode.Video,
      script,
      // TODO calculate length using AudioGenerator -> TTS
      40,
      Presets.WATERCOLOR,
    );
  }

  return new Response(JSON.stringify({ message: "job queued" }));
}
