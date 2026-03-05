import { TextGenerator } from "../../text/text-generator";

export async function text_to_script() {
  // TODO get these from query parameters
  const prompt =
    "The symbolism of baptism, creation, the void, the flood, a new creation and how they all are connected.";

  const res = await TextGenerator.create_script(prompt);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }

  await Bun.write(
    `/home/dennis/work/silicon-seeds/content/scripts/${Bun.randomUUIDv7()}.md`,
    res,
  );
  return new Response(JSON.stringify({ message: res }));
}
