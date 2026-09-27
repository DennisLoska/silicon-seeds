import { createSignal, createResource, For, Show } from "solid-js";

export type LoraSpec = { name: string; strength: number };
type LoraRow = {
  id: string;
  comfyui_name: string;
  display_name: string;
  trigger_word: string | null;
  is_active: number;
  sort_order: number;
};

export default function LoraSelector(props: {
  value: LoraSpec[];
  onChange: (v: LoraSpec[]) => void;
}) {
  const [loras] = createResource(async () => {
    try {
      const r = await fetch("/api/loras");
      if (!r.ok) return [];
      const j = await r.json();
      return (j.loras as LoraRow[]).filter((l) => l.is_active);
    } catch {
      return [];
    }
  });
  const [selectedName, setSelectedName] = createSignal("");

  const add = () => {
    const name = selectedName();
    if (!name) return;
    if (props.value.some((v) => v.name === name)) return;
    props.onChange([...props.value, { name, strength: 0.7 }]);
    setSelectedName("");
  };
  const remove = (idx: number) =>
    props.onChange(props.value.filter((_, i) => i !== idx));
  const updateStrength = (idx: number, s: number) => {
    const copy = [...props.value];
    copy[idx] = { ...copy[idx], strength: s };
    props.onChange(copy);
  };
  const move = (idx: number, dir: number) => {
    const arr = [...props.value];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    props.onChange(arr);
  };
  const onDragStart = (e: DragEvent, idx: number) =>
    e.dataTransfer?.setData("text/plain", String(idx));
  const onDrop = (e: DragEvent, idx: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer?.getData("text/plain") ?? "", 10);
    if (isNaN(from)) return;
    const arr = [...props.value];
    const [moved] = arr.splice(from, 1);
    arr.splice(idx, 0, moved);
    props.onChange(arr);
  };

  return (
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <select
          class="select select-bordered select-sm flex-1"
          value={selectedName()}
          onChange={(e) => setSelectedName(e.currentTarget.value)}
        >
          <option value="">Select lora</option>
          <For each={loras() ?? []}>
            {(l) => (
              <option value={l.comfyui_name}>
                {l.display_name} ({l.comfyui_name})
              </option>
            )}
          </For>
        </select>
        <button type="button" class="btn btn-sm btn-primary" onClick={add}>
          Add
        </button>
      </div>
      <Show when={props.value.length === 0}>
        <span class="text-xs opacity-60">
          No loras selected. Add from DB catalog.
        </span>
      </Show>
      <div class="flex flex-col gap-2">
        <For each={props.value}>
          {(spec, idx) => (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, idx())}
              class="flex items-center gap-2 p-2 bg-base-200 rounded border border-base-300 hover:border-primary/20"
            >
              <span
                draggable
                onDragStart={(e) => onDragStart(e, idx())}
                class="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-80 select-none px-1"
              >
                ≡
              </span>
              <span class="flex-1 text-sm font-mono truncate">{spec.name}</span>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={String(spec.strength)}
                onInput={(e) =>
                  updateStrength(idx(), parseFloat(e.currentTarget.value))
                }
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                class="range range-primary range-sm w-32 cursor-pointer"
                style="touch-action: pan-x;"
              />
              <span class="text-xs w-8 text-center tabular-nums">
                {spec.strength.toFixed(1)}
              </span>
              <button
                type="button"
                class="btn btn-xs"
                onClick={() => move(idx(), -1)}
              >
                ↑
              </button>
              <button
                type="button"
                class="btn btn-xs"
                onClick={() => move(idx(), 1)}
              >
                ↓
              </button>
              <button
                type="button"
                class="btn btn-xs btn-error"
                onClick={() => remove(idx())}
              >
                x
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
