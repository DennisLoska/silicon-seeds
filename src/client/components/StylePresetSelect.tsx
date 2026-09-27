import { createResource, For, Show } from "solid-js";

type Preset = {
  id: string;
  name: string;
  description: string | null;
  primary_style: string;
  secondary_trigger: string | null;
  styles: string[];
  texture: string | null;
};

export default function StylePresetSelect(props: {
  name?: string;
  value?: string;
  id?: string;
  class?: string;
}) {
  const [presets] = createResource(async () => {
    try {
      const r = await fetch("/api/style-presets");
      if (!r.ok) return [] as Preset[];
      const j = await r.json();
      return (j.presets ?? []) as Preset[];
    } catch {
      return [] as Preset[];
    }
  });

  return (
    <select
      name={props.name ?? "style_preset"}
      id={props.id}
      class={props.class ?? "select select-bordered w-full select-sm"}
    >
      <Show when={!presets.loading} fallback={<option>Loading...</option>}>
        <option value="none">none - no style</option>
        <For each={presets() ?? []}>
          {(p) => <option value={p.name}>{p.name}</option>}
        </For>
        <Show when={(presets() ?? []).length === 0}>
          <option value="system">system</option>
          <option value="watercolor">watercolor</option>
          <option value="pencil_watercolor">pencil_watercolor</option>
        </Show>
      </Show>
    </select>
  );
}
