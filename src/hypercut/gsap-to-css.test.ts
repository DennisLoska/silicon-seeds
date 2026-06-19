import { describe, it, expect } from "bun:test";
import { gsapFromToToCss, parseGsapFromToCalls, type GsapTween } from "./gsap-to-css";

describe("gsapFromToToCss", () => {
  it("converts opacity + scale + rotation fromTo into @keyframes", () => {
    const tween: GsapTween = {
      selector: "#sugg-abc",
      fromProps: { scale: 0.3, rotation: -15, opacity: 0 },
      toProps: { scale: 0.6, rotation: 5, opacity: 1 },
      duration: 1.19,
      ease: "power2.out",
      position: 1.5,
    };
    const css = gsapFromToToCss(tween);
    expect(css).not.toBeNull();
    expect(css!.name).toBe("sugg-abc-anim");
    expect(css!.selector).toBe("#sugg-abc");
    expect(css!.keyframes).toContain("@keyframes sugg-abc-anim");
    expect(css!.keyframes).toContain("opacity: 0");
    expect(css!.keyframes).toContain("opacity: 1");
    expect(css!.keyframes).toContain("transform: scale(0.3) rotate(-15deg)");
    expect(css!.keyframes).toContain("transform: scale(0.6) rotate(5deg)");
    expect(css!.animationDecl).toContain("animation: sugg-abc-anim 1.19s ease-out 1.5s 1 both");
  });

  it("returns null when selector is not an id selector", () => {
    const tween: GsapTween = {
      selector: ".overlay",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
    };
    expect(gsapFromToToCss(tween)).toBeNull();
  });

  it("returns null when props contain unsupported keys", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { filter: "blur(5px)" },
      toProps: { filter: "blur(0px)" },
      duration: 1,
    };
    expect(gsapFromToToCss(tween)).toBeNull();
  });

  it("maps ease power3.in to ease-in", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
      ease: "power3.in",
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toContain("ease-in");
  });

  it("defaults ease to ease-out when ease is missing", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toContain("ease-out");
  });

  it("handles x/y translate props", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { x: -100, opacity: 0 },
      toProps: { x: 0, opacity: 1 },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.keyframes).toContain("transform: translate(-100px, 0px)");
    expect(css!.keyframes).toContain("transform: translate(0px, 0px)");
  });

  it("handles backgroundColor", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { backgroundColor: "#ff0000" },
      toProps: { backgroundColor: "#00ff00" },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.keyframes).toContain("background-color: #ff0000");
    expect(css!.keyframes).toContain("background-color: #00ff00");
  });

  it("handles position 0 (no delay suffix)", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
      position: 0,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toBe("animation: x-anim 1s ease-out 0s 1 both");
  });
});

describe("parseGsapFromToCalls", () => {
  it("extracts a tl.fromTo call with numeric props", () => {
    const script = `
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#sugg-abc",
        { scale: 0.3, rotation: -15, opacity: 0 },
        { scale: 0.6, rotation: 5, opacity: 1, duration: 1.19, ease: "power2.out" }
      );
      tl.to({}, { duration: 55 });
    `;
    const calls = parseGsapFromToCalls(script);
    expect(calls.length).toBe(1);
    expect(calls[0].selector).toBe("#sugg-abc");
    expect(calls[0].fromProps.scale).toBe(0.3);
    expect(calls[0].toProps.scale).toBe(0.6);
    expect(calls[0].duration).toBe(1.19);
    expect(calls[0].ease).toBe("power2.out");
    expect(calls[0].position).toBe(0);
  });

  it("returns empty array when no fromTo calls", () => {
    const script = `const tl = gsap.timeline({ paused: true }); tl.to({}, { duration: 5 });`;
    expect(parseGsapFromToCalls(script)).toEqual([]);
  });

  it("handles fromTo with a leading position argument", () => {
    const script = `
      tl.fromTo("#x", { opacity: 0 }, { opacity: 1, duration: 1 }, 1.5);
    `;
    const calls = parseGsapFromToCalls(script);
    expect(calls.length).toBe(1);
    expect(calls[0].position).toBe(1.5);
  });
});
