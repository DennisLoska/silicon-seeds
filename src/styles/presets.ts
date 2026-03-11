import { type StyleParams, StylePrompt } from "./system";
import { Styles } from "./styles";

export enum Presets {
  SYSTEM = "system",
  WATERCOLOR = "watercolor",
}

export namespace StylePresets {
  export const presets = {
    [Presets.SYSTEM]: system,
    [Presets.WATERCOLOR]: watercolor,
  };

  function system(opt: Omit<StyleParams, "style">): string {
    const style = {
      primary: Styles.NONE.name,
      styles: Styles.NONE.styles,
      texture: Styles.TEXTURE.none,
    };

    return StylePrompt.system({
      style,
      title: opt.title,
      description: opt.description,
      scenes: opt.scenes,
    });
  }

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
