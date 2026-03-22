import { type StyleParams, StylePrompt } from "./system";
import { Styles } from "./styles";

export enum Presets {
  SYSTEM = "system",
  WATERCOLOR = "watercolor",
  PENCIL_WATERCOLOR = "pencil_watercolor",
}

export enum Lora {
  PENCIL_SKETCH = "Zimage_pencil_sketch",
}

export namespace StylePresets {
  export const presets = {
    [Presets.SYSTEM]: system,
    [Presets.WATERCOLOR]: watercolor,
    [Presets.PENCIL_WATERCOLOR]: pencil_watercolor,
  };

  function system(opt: Omit<StyleParams, "style">) {
    const style = {
      primary: Styles.NONE.name,
      styles: Styles.NONE.styles,
      texture: Styles.TEXTURE.none,
    };

    return {
      lora: undefined,
      instructions: StylePrompt.system({
        style,
        title: opt.title,
        description: opt.description,
        scenes: opt.scenes,
      }),
    };
  }

  function watercolor(opt: Omit<StyleParams, "style">) {
    const style = {
      primary: Styles.WATERCOLOR.name,
      styles: Styles.WATERCOLOR.styles,
      texture: Styles.TEXTURE.paper,
    };

    return {
      lora: undefined,
      instructions: StylePrompt.system({
        style,
        title: opt.title,
        description: opt.description,
        scenes: opt.scenes,
      }),
    };
  }

  function pencil_watercolor(opt: Omit<StyleParams, "style">) {
    const style = {
      lora: Lora.PENCIL_SKETCH,
      primary: Styles.WATERCOLOR.name,
      secondary: "pencil sketch",
      styles: Styles.WATERCOLOR.styles,
      texture: Styles.TEXTURE.paper,
    };

    return {
      lora: style.lora,
      instructions: StylePrompt.system({
        style,
        title: opt.title,
        description: opt.description,
        scenes: opt.scenes,
      }),
    };
  }
}
