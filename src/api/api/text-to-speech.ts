import { AudioGenerator } from "../../audio/audio-generator";
import { JobOrchestrator } from "../../jobs/jobs";

export async function text_to_speech() {
  // TODO get these from query parameters
  const messages = [
    "Dunder Mifflin is the best paper company in Scranton!",
    "That's what she said.",
    "I'm not superstitious, but I am a little stitious.",
    "Bears. Beets. Battlestar Galactica.",
    "Identity theft is not a joke, Jim! It's a serious crime!",
    "I declare bankruptcy!",
    "I am Beyoncé, always.",
    "No yes, but.",
    "Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me.",
    "I'm not a millionaire. I thought I would be by the time I was thirty. I have my degree in Early Childhood Education.",
  ];

  const prompt = messages[Math.floor(Math.random() * messages.length)];
  const { id: jobId } = await JobOrchestrator.create_job({});
  await AudioGenerator.schedule_audio({
    jobId,
    prompt,
  });

  return new Response(JSON.stringify({ message: "job queued", jobId }), {
    status: 202,
  });
}
