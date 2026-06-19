export interface GsapTween {
  selector: string;
  fromProps: Record<string, number | string>;
  toProps: Record<string, number | string>;
  duration: number;
  ease?: string;
  position?: number;
}

export interface CssAnimation {
  name: string;
  keyframes: string;
  animationDecl: string;
  selector: string;
}

const SUPPORTED_PROPS = new Set([
  "opacity",
  "scale",
  "rotation",
  "x",
  "y",
  "backgroundColor",
]);

const EASE_MAP: Record<string, string> = {
  "power1.out": "ease-out",
  "power2.out": "ease-out",
  "power3.out": "ease-out",
  "power4.out": "ease-out",
  "sine.out": "ease-out",
  "power1.in": "ease-in",
  "power2.in": "ease-in",
  "power3.in": "ease-in",
  "power4.in": "ease-in",
  "sine.in": "ease-in",
  "power1.inOut": "ease-in-out",
  "power2.inOut": "ease-in-out",
  "power3.inOut": "ease-in-out",
  "power4.inOut": "ease-in-out",
  "sine.inOut": "ease-in-out",
  "none": "linear",
};

function buildTransform(props: Record<string, number | string>): string | null {
  const scale = props.scale;
  const rotation = props.rotation;
  const x = props.x;
  const y = props.y;
  const parts: string[] = [];
  if (x !== undefined) parts.push(`translate(${x}px, ${y ?? 0}px)`);
  if (scale !== undefined) parts.push(`scale(${scale})`);
  if (rotation !== undefined) parts.push(`rotate(${rotation}deg)`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function propsToCss(props: Record<string, number | string>): string {
  const lines: string[] = [];
  if (props.opacity !== undefined) lines.push(`opacity: ${props.opacity}`);
  if (props.backgroundColor !== undefined) lines.push(`background-color: ${props.backgroundColor}`);
  const transform = buildTransform(props);
  if (transform) lines.push(`transform: ${transform}`);
  return lines.join("; ");
}

export function gsapFromToToCss(tween: GsapTween): CssAnimation | null {
  if (!tween.selector.startsWith("#")) return null;

  const allProps = new Set<string>([
    ...Object.keys(tween.fromProps),
    ...Object.keys(tween.toProps),
  ]);
  for (const prop of allProps) {
    if (!SUPPORTED_PROPS.has(prop)) return null;
  }

  const id = tween.selector.slice(1);
  const name = `${id}-anim`;
  const fromCss = propsToCss(tween.fromProps);
  const toCss = propsToCss(tween.toProps);
  const ease = EASE_MAP[tween.ease ?? "power2.out"] ?? "ease-out";
  const position = tween.position ?? 0;

  const keyframes = `@keyframes ${name} { from { ${fromCss}; } to { ${toCss}; } }`;
  const animationDecl = `animation: ${name} ${tween.duration}s ${ease} ${position}s 1 both`;

  return { name, keyframes, animationDecl, selector: tween.selector };
}

export function parseGsapFromToCalls(scriptContent: string): GsapTween[] {
  const calls: GsapTween[] = [];
  const re =
    /\.fromTo\s*\(\s*["']([#.][^"']+)["']\s*,\s*\{([\s\S]*?)\}\s*,\s*\{([\s\S]*?)\}\s*(?:,\s*([0-9.]+))?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(scriptContent)) !== null) {
    const selector = match[1];
    const fromBlock = match[2];
    const toBlock = match[3];
    const positionStr = match[4];
    const fromProps = parsePropsBlock(fromBlock);
    const toProps = parsePropsBlock(toBlock);
    const duration = typeof toProps.duration === "number" ? toProps.duration : 0;
    const ease = typeof toProps.ease === "string" ? toProps.ease : undefined;
    if (duration <= 0) continue;
    const cleanedFrom = { ...fromProps };
    const cleanedTo = { ...toProps };
    delete cleanedFrom.duration;
    delete cleanedFrom.ease;
    delete cleanedTo.duration;
    delete cleanedTo.ease;
    calls.push({
      selector,
      fromProps: cleanedFrom,
      toProps: cleanedTo,
      duration,
      ease,
      position: positionStr ? Number(positionStr) : 0,
    });
  }
  return calls;
}

function parsePropsBlock(block: string): Record<string, number | string> {
  const props: Record<string, number | string> = {};
  const re = /([A-Za-z_]+)\s*:\s*([0-9.]+|"[^"]*"|'[^']*')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const raw = m[2];
    if (raw.startsWith('"') || raw.startsWith("'")) {
      props[key] = raw.slice(1, -1);
    } else {
      props[key] = Number(raw);
    }
  }
  return props;
}
