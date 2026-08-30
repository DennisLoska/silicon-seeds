import { createSignal, createResource, For, Show } from "solid-js";
import { Icons } from "../components/Icons";

type SettingsMap = Record<string, string>;
type Preset = { id: string; name: string; description: string | null; primary_style: string; secondary_trigger: string | null; styles: string[]; texture: string | null };
type LoraRow = { id: string; comfyui_name: string; display_name: string; trigger_word: string | null; is_active: number; sort_order: number };

export default function Settings() {
  const [settings, setSettings] = createSignal<SettingsMap>({});
  const [presets, setPresets] = createSignal<Preset[]>([]);
  const [loras, setLoras] = createSignal<LoraRow[]>([]);
  const [discovered, setDiscovered] = createSignal<string[]>([]);
  const [msg, setMsg] = createSignal<string | null>(null);
  const [err, setErr] = createSignal<string | null>(null);

  // modals
  const [editPreset, setEditPreset] = createSignal<Preset | null>(null);
  const [newPresetForm, setNewPresetForm] = createSignal(false);
  const [presetForm, setPresetForm] = createSignal({ name: "", description: "", primary_style: "", secondary_trigger: "", styles: "", texture: "" });

  async function fetchAll() {
    try {
      const s = await fetch("/api/settings").then((r) => r.json());
      setSettings(s);
      const p = await fetch("/api/style-presets").then((r) => r.json());
      setPresets(p.presets ?? []);
      const l = await fetch("/api/loras").then((r) => r.json());
      setLoras(l.loras ?? []);
    } catch (e) { setErr(String(e)); }
  }
  fetchAll();

  const saveSettings = async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const entries: Record<string, string> = {};
    for (const [k, v] of fd.entries()) entries[k] = String(v);
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entries) });
    if (!res.ok) setErr(await res.text()); else { setMsg("Settings saved"); setTimeout(() => setMsg(null), 1500); fetchAll(); }
  };

  const createPreset = async () => {
    const f = presetForm();
    const stylesArr = f.styles.split("\n").map((s) => s.trim()).filter(Boolean);
    const body = { name: f.name, description: f.description || null, primary_style: f.primary_style || f.name, secondary_trigger: f.secondary_trigger || null, styles: stylesArr, texture: f.texture || null };
    const res = await fetch("/api/style-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setErr(await res.text()); else { setNewPresetForm(false); setPresetForm({ name: "", description: "", primary_style: "", secondary_trigger: "", styles: "", texture: "" }); fetchAll(); }
  };

  const updatePreset = async () => {
    const p = editPreset(); if (!p) return;
    const f = presetForm();
    const stylesArr = f.styles.split("\n").map((s) => s.trim()).filter(Boolean);
    const body: any = {};
    if (f.name) body.name = f.name;
    if (f.description !== undefined) body.description = f.description || null;
    if (f.primary_style) body.primary_style = f.primary_style;
    if (f.secondary_trigger !== undefined) body.secondary_trigger = f.secondary_trigger || null;
    if (stylesArr.length) body.styles = stylesArr;
    if (f.texture !== undefined) body.texture = f.texture || null;
    const res = await fetch(`/api/style-presets/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setErr(await res.text()); else { setEditPreset(null); fetchAll(); }
  };

  const deletePreset = async (id: string) => {
    if (!confirm("Delete preset?")) return;
    await fetch(`/api/style-presets/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const syncLoras = async () => {
    setErr(null);
    const res = await fetch("/api/comfyui/loras");
    if (!res.ok) { setErr("ComfyUI unreachable: " + (await res.text()).slice(0, 200)); return; }
    const data = await res.json();
    setDiscovered(data.loras ?? []);
  };
  const addDiscovered = async (name: string) => {
    const res = await fetch("/api/loras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comfyui_name: name, display_name: name.replace(/\.safetensors$/i, "") }) });
    if (!res.ok) setErr(await res.text()); else fetchAll();
  };
  const toggleLora = async (row: LoraRow) => {
    await fetch(`/api/loras/${row.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: row.is_active ? 0 : 1 }) });
    fetchAll();
  };
  const deleteLora = async (id: string) => {
    if (!confirm("Delete lora?")) return;
    await fetch(`/api/loras/${id}`, { method: "DELETE" });
    fetchAll();
  };
  const moveLora = async (idx: number, dir: number) => {
    const list = [...loras()];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    setLoras(list);
    const ids = list.map((r) => r.id);
    await fetch("/api/loras/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    fetchAll();
  };
  const dragStart = (e: DragEvent, idx: number) => { e.dataTransfer?.setData("text/plain", String(idx)); };
  const drop = async (e: DragEvent, idx: number) => {
    e.preventDefault();
    const from = parseInt((e.dataTransfer?.getData("text/plain") ?? ""), 10);
    if (isNaN(from)) return;
    const list = [...loras()];
    const [moved] = list.splice(from, 1);
    list.splice(idx, 0, moved);
    setLoras(list);
    await fetch("/api/loras/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: list.map((r) => r.id) }) });
    fetchAll();
  };

  return (
    <div class="flex flex-col gap-6 p-4 sm:p-6 bg-base-200 min-h-[calc(100vh-4rem)]">
      <Show when={msg()}><div class="alert alert-success text-sm">{msg()}</div></Show>
      <Show when={err()}><div class="alert alert-error text-sm">{err()}</div></Show>

      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Defaults</h2>
          <form onSubmit={saveSettings} class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="form-control"><span class="label-text">Default Style Preset</span><input name="default_style_preset" class="input input-bordered" value={settings()["default_style_preset"] ?? ""} /></label>
            <label class="form-control"><span class="label-text">FPS</span><input name="default_fps" type="number" class="input input-bordered" value={settings()["default_fps"] ?? "16"} /></label>
            <label class="form-control"><span class="label-text">Clip Duration</span><input name="default_clip_duration" type="number" class="input input-bordered" value={settings()["default_clip_duration"] ?? "5"} /></label>
            <label class="form-control"><span class="label-text">Transition Duration</span><input name="default_transition_duration" type="number" class="input input-bordered" value={settings()["default_transition_duration"] ?? "2"} /></label>
            <label class="form-control"><span class="label-text">Resolution</span><select name="default_resolution" class="select select-bordered"><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="9_16_SD">9:16 SD</option><option value="9_16_HD">9:16 HD</option></select></label>
            <label class="form-control"><span class="label-text">Image Model</span><input name="default_image_model" class="input input-bordered" value={settings()["default_image_model"] ?? "z-image-turbo"} /></label>
            <label class="form-control"><span class="label-text">Video Model</span><select name="default_video_model" class="select select-bordered"><option value="wan2.2">Wan 2.2</option><option value="ltx2.3">LTX 2.3</option></select></label>
            <div class="md:col-span-3"><button class="btn btn-primary">Save Defaults</button></div>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center"><h2 class="card-title">Style Presets</h2><button class="btn btn-sm btn-primary" onClick={() => setNewPresetForm(true)}>New</button></div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead><tr><th>Name</th><th>Primary</th><th>Trigger</th><th>Styles</th><th></th></tr></thead>
              <tbody>
                <For each={presets()}>
                  {(p) => (
                    <tr>
                      <td class="font-mono text-sm">{p.name}</td><td>{p.primary_style}</td><td>{p.secondary_trigger ?? "-"}</td><td>{p.styles.length}</td>
                      <td class="flex gap-1">
                        <button class="btn btn-xs" onClick={() => { setEditPreset(p); setPresetForm({ name: p.name, description: p.description ?? "", primary_style: p.primary_style, secondary_trigger: p.secondary_trigger ?? "", styles: p.styles.join("\n"), texture: p.texture ?? "" }); }}>Edit</button>
                        <button class="btn btn-xs btn-error" onClick={() => deletePreset(p.id)}>Del</button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Show when={newPresetForm() || editPreset()}>
        <div class="card bg-base-100 shadow-xl border-2 border-primary">
          <div class="card-body gap-3">
            <h3 class="font-bold">{editPreset() ? "Edit Preset" : "New Preset"}</h3>
            <input class="input input-bordered w-full" placeholder="name" value={presetForm().name} onInput={(e) => setPresetForm({ ...presetForm(), name: e.currentTarget.value })} />
            <input class="input input-bordered w-full" placeholder="description" value={presetForm().description} onInput={(e) => setPresetForm({ ...presetForm(), description: e.currentTarget.value })} />
            <input class="input input-bordered w-full" placeholder="primary_style" value={presetForm().primary_style} onInput={(e) => setPresetForm({ ...presetForm(), primary_style: e.currentTarget.value })} />
            <input class="input input-bordered w-full" placeholder="secondary_trigger (optional)" value={presetForm().secondary_trigger} onInput={(e) => setPresetForm({ ...presetForm(), secondary_trigger: e.currentTarget.value })} />
            <input class="input input-bordered w-full" placeholder="texture (optional)" value={presetForm().texture} onInput={(e) => setPresetForm({ ...presetForm(), texture: e.currentTarget.value })} />
            <textarea class="textarea textarea-bordered w-full h-32" placeholder="styles — one per line" value={presetForm().styles} onInput={(e) => setPresetForm({ ...presetForm(), styles: e.currentTarget.value })} />
            <div class="flex gap-2 justify-end">
              <button class="btn btn-ghost" onClick={() => { setNewPresetForm(false); setEditPreset(null); }}>Cancel</button>
              <button class="btn btn-primary" onClick={() => (editPreset() ? updatePreset() : createPreset())}>{editPreset() ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      </Show>

      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center"><h2 class="card-title">Loras</h2><button class="btn btn-sm" onClick={syncLoras}>Sync from ComfyUI</button></div>
          <Show when={discovered().length}>
            <div class="flex flex-wrap gap-2 p-2 bg-base-200 rounded">
              <For each={discovered()}>
                {(name) => <button class="btn btn-xs btn-outline" onClick={() => addDiscovered(name)}>+ {name}</button>}
              </For>
            </div>
          </Show>
          <div class="flex flex-col gap-2">
            <For each={loras()}>
              {(row, idx) => (
                <div draggable onDragStart={(e) => dragStart(e, idx())} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, idx())} class="flex items-center gap-2 p-2 bg-base-200 rounded cursor-move">
                  <span class="drag-handle opacity-50">≡</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-sm truncate">{row.comfyui_name}</div>
                    <div class="text-xs opacity-60">{row.display_name} {row.trigger_word ? `· trigger: ${row.trigger_word}` : ""}</div>
                  </div>
                  <button class={"btn btn-xs " + (row.is_active ? "btn-success" : "btn-ghost")} onClick={() => toggleLora(row)}>{row.is_active ? "active" : "off"}</button>
                  <button class="btn btn-xs" onClick={() => moveLora(idx(), -1)}>↑</button>
                  <button class="btn btn-xs" onClick={() => moveLora(idx(), 1)}>↓</button>
                  <button class="btn btn-xs btn-error" onClick={() => deleteLora(row.id)}>x</button>
                </div>
              )}
            </For>
            <Show when={loras().length === 0}><div class="text-sm opacity-60">No loras in DB. Sync from ComfyUI.</div></Show>
          </div>
        </div>
      </div>
    </div>
  );
}
