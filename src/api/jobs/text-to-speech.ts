import { AudioGenerator } from "../../audio/audio-generator";
import { comfyClient } from "../../comfyui/comfyui-client";
import { Metadata } from "../../meta/meta";

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
  const id = Metadata.randomId();

  AudioGenerator.schedule_audio({
    id,
    prompt,
  });

  try {
    const res = (await AudioGenerator.get_audio(id)) as any;

    const metadata = res?.data?.audio?.[0];
    let audio: Blob | null = await comfyClient.getAsset(
      metadata.filename,
      metadata.subfolder,
      metadata.type,
    );

    const duration = await Metadata.getAudioDuration(audio);
    audio = null;

    return new Response(JSON.stringify({ message: { ...metadata, duration } }));
  } catch (error) {
    console.log(error);
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }
}
