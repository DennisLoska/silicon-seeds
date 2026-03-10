import { AudioGenerator } from "../../audio/audio-generator";
import { Metadata } from "../../meta/meta";

export async function text_to_speech() {
  // TODO get these from query parameters
  const prompt = "Computer says yes!";

  const res = await AudioGenerator.tts(Metadata.randomId(), prompt);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ message: res }));
}
