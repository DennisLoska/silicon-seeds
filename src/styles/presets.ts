import { type StyleParams, StylePrompt } from "./system";
import { Styles } from "./styles";

export enum Presets {
  WATERCOLOR = "watercolor",
}

export namespace StylePresets {
  export const presets = {
    [Presets.WATERCOLOR]: watercolor,
  };

  function watercolor(opt: Omit<StyleParams, "style">): string {
    const style = {
      primary: Styles.WATERCOLOR.name,
      styles: Styles.WATERCOLOR.styles,
      texture: Styles.TEXTURE.paper,
    };

    return StylePrompt.system({
      style,
      title: opt.title,
      description: opt.description,
      scenes: opt.scenes,
    });
  }
}
