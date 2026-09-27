import { join } from "node:path";
import { TextGenerator } from "../../text/text-generator";

export async function text_to_script(prompt: string) {
  // TODO get these from query parameters
  // const prompt =
  // "The symbolism of baptism, creation, the void, the flood, a new creation and how they all are connected.";

  const res = await TextGenerator.create_script(prompt);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }

  const scriptsDir = Bun.env.SCRIPTS_DIR
    ?? join(Bun.env.CONTENT_LIBRARY_DIR ?? join(process.cwd(), "content"), "scripts");

  await Bun.write(join(scriptsDir, `${Bun.randomUUIDv7()}.md`), res);

  return new Response(JSON.stringify({ message: res }));
}
