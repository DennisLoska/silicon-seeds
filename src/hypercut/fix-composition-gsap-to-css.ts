import { parseGsapFromToCalls, gsapFromToToCss } from "./gsap-to-css";

async function fixFile(compPath: string): Promise<void> {
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    console.error(`File not found: ${compPath}`);
    process.exit(1);
  }
  let html = await file.text();
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let anyConverted = false;
  const keyframesBlocks: string[] = [];
  const elementUpdates: Array<{ selector: string; animationDecl: string }> = [];

  while ((m = scriptRe.exec(html)) !== null) {
    const scriptContent = m[1] ?? "";
    if (!/gsap\.timeline/.test(scriptContent)) continue;
    if (!/window\.__timelines\[/.test(scriptContent)) continue;
    const fromToCalls = parseGsapFromToCalls(scriptContent);
    if (fromToCalls.length === 0) continue;

    let newScript = scriptContent;
    for (const tween of fromToCalls) {
      if (tween.selector.startsWith("#")) {
        const id = tween.selector.slice(1);
        const elRe = new RegExp(`<[^>]*\\bid="${id}"[^>]*>`, "g");
        const elMatch = elRe.exec(html);
        if (elMatch) {
          const elRaw = elMatch[0];
          const startMatch = elRaw.match(/data-start="([^"]+)"/);
          if (startMatch) {
            const dataStart = Number(startMatch[1]);
            if (Number.isFinite(dataStart) && dataStart > 0) {
              tween.position = dataStart;
            }
          }
        }
      }
      const css = gsapFromToToCss(tween);
      if (!css) {
        console.warn(`Skipping unsupported tween on ${tween.selector}`);
        continue;
      }
      const callRe = new RegExp(
        `\\.fromTo\\s*\\(\\s*["']${tween.selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][\\s\\S]*?\\)\\s*;?`,
        "g",
      );
      newScript = newScript.replace(callRe, "");
      keyframesBlocks.push(css.keyframes);
      elementUpdates.push({ selector: css.selector, animationDecl: css.animationDecl });
      console.log(`Converted ${tween.selector} -> ${css.name}`);
      anyConverted = true;
    }
    if (newScript !== scriptContent) {
      html = html.replace(scriptContent, newScript);
    }
  }

  if (!anyConverted) {
    console.log("No convertible GSAP fromTo tweens found.");
    return;
  }

  if (keyframesBlocks.length > 0) {
    const styleBlock = `\n    <style>\n      ${keyframesBlocks.join("\n      ")}\n    </style>\n  </head>`;
    html = html.replace("</head>", styleBlock);
  }
  for (const { selector, animationDecl } of elementUpdates) {
    const id = selector.slice(1);
    const elRe = new RegExp(`(<[^>]*\\bid="${id}"[^>]*?)\\sstyle="([^"]*)"`, "g");
    html = html.replace(elRe, (full, before: string, style: string) => {
      const cleanedStyle = style
        .replace(/transform\s*:[^;]+;?/g, "")
        .replace(/opacity\s*:\s*0\s*;?/g, "")
        .trim()
        .replace(/\s+/g, " ");
      const finalStyle = `${cleanedStyle} ${animationDecl};`.replace(/\s+;/g, ";").trim();
      return full.replace(`style="${style}"`, `style="${finalStyle}"`);
    });
  }

  await Bun.write(compPath, html);
  console.log(`Wrote fixed composition to ${compPath}`);
}

const compPath = process.argv[2];
if (!compPath) {
  console.error("Usage: bun src/hypercut/fix-composition-gsap-to-css.ts <path-to-index.html>");
  process.exit(1);
}
fixFile(compPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
