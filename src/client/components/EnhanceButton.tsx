import { createSignal, Show } from "solid-js";
import SparkleIcon from "./SparkleIcon";
import EnhanceModal from "./EnhanceModal";
import type { EnhanceKind } from "../../prompts/prompt-enhancer";

export type EnhanceButtonProps = {
  textareaId: string;
  kind: EnhanceKind;
  getPreset?: () => string | undefined;
};

export default function EnhanceButton(props: EnhanceButtonProps) {
  const [open, setOpen] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [original, setOriginal] = createSignal("");
  const [enhanced, setEnhanced] = createSignal("");
  const [error, setError] = createSignal("");

  function readTextarea(): string {
    const el = document.getElementById(props.textareaId) as HTMLTextAreaElement | null;
    return el?.value ?? "";
  }

  async function run() {
    const text = readTextarea();
    setOriginal(text);
    setEnhanced("");
    setError("");
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind: props.kind, style_preset: props.getPreset?.() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Enhance failed (${res.status})`);
      if (!data.enhanced) throw new Error("Empty response, try again");
      setEnhanced(data.enhanced);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enhance failed, try again");
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    const el = document.getElementById(props.textareaId) as HTMLTextAreaElement | null;
    if (el && enhanced()) {
      el.value = enhanced();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setOpen(false);
  }

  function label(): string {
    return readTextarea().trim() ? "Enhance" : "Inspire";
  }

  return (
    <>
      <button type="button" class="btn btn-xs btn-ghost gap-1" onClick={run} disabled={loading()}>
        <Show when={loading()} fallback={<SparkleIcon />}>
          <span class="loading loading-spinner loading-xs" />
        </Show>
        {label()}
      </button>
      <EnhanceModal
        open={open()}
        original={original()}
        enhanced={enhanced()}
        loading={loading()}
        error={error()}
        onAccept={accept}
        onRetry={run}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
