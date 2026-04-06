import { TextGenerator } from "../../text/text-generator";

export async function text_to_text() {
  // TODO get these from query parameters
  const input = "A sermon about the parable of the Sower.";
  const res = await TextGenerator.text(input);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no." }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ message: res }));
}
