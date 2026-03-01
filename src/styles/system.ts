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

  Tips:
  - Front-load the most important elements (subject + medium first)
  - ~250-500 words tends to be the sweet spot
  - Prefer concrete subjects over abstract descriptions
`;
  }
}
