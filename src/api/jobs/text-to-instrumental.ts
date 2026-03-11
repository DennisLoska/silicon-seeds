import { AudioGenerator } from "../../audio/audio-generator";
import { Metadata } from "../../meta/meta";

export async function text_to_instrumental() {
  // TODO get this from Metadata based on tts length
  const duration = 120;
  const prompt = undefined;

  const id = Metadata.randomId();
  AudioGenerator.schedule_audio({ id, duration, prompt });

  try {
    const res = (await AudioGenerator.get_audio(id)) as any;
    const metadata = res?.data?.audio?.[0];

    return new Response(JSON.stringify({ message: { ...metadata } }));
  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }
}
