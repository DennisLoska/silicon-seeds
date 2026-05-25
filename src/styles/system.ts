export type Style = {
  primary: string;
  secondary?: string;
  styles: string[];
  texture: string;
};

export type StyleParams = {
  style: Style;
  title: string;
  description?: string;
  scenes?: string[];
};

export interface Instruction {
  name: string;
  prompt: string;
}

export namespace StylePrompt {
  export function system(opt: StyleParams) {
    return `Create a prompt for a single image for the following user request: ${opt.title}

  FOR ALL PROMPTS ALWAYS (if provided): ${opt.description ?? "No further instruction provided by user."}

  Keeping aforementioned instructions in mind create the image prompt for me by using
  the following instructions as a template:

  ${opt.style.secondary ?? ""} [primary style: ${opt.style.primary}],
  [texture: ${opt.style.texture}], [subject & focal point], [setting & composition],
  [light & atmosphere], [palette], [techniques & edges], [mood adjectives], [finegranular texture]

  Examples styles to use (if provided):

  ${JSON.stringify(opt.style.styles)}

  Examples scenes for reference only (if provided):

  ${JSON.stringify(opt.scenes ?? "Scenes not provided by user.")}

  Use these example scenes PURELY as reference ONLY, but never use these exact examples.
  Instead come up with a completely new variety of different scenes for the list of prompts.

  Style lock:
  - You must faithfully follow the requested visual style.
  - The final prompt must clearly read as ${opt.style.primary}${opt.style.secondary ? ` with ${opt.style.secondary}` : ""}.
  - Do not substitute a different style family such as futuristic digital art, cyberpunk, photorealism, 3d render, vector art, glossy UI art, or cinematic sci-fi unless those are explicitly part of the requested style examples.
  - If the requested style uses paper, paint, pigment, sketch, watercolor, or other physical-media cues, those cues must be dominant in the final prompt.
  - The subject can vary, but the style is not optional.

  Important rules:
  - There should be no words or text in the image

  Tips:
  - Front-load the most important elements (subject + medium first)
  - ~250-500 words tends to be the sweet spot
  - Prefer concrete subjects over abstract descriptions
`;
  }
}
