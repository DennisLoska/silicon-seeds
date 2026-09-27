export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

export type GalleryItem = {
  meta_id: string;
  event_id: string;
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
  created_at: string;
  job_id: string;
  mediaType: "image" | "video" | "audio" | null;
};

export type EventRow = {
  id: string;
  created_at: string;
  job_id: string;
  mode: string;
  status: string;
  priority: number;
  type: string;
  text: string | null;
  prompt: string | null;
  filename: string | null;
  start_img: string | null;
  end_img: string | null;
  duration: number | null;
  lyrics: string | null;
  audio_settings: string | null;
  index: number | null;
  claimed_at: string | null;
  attempt_count: number;
  error: string | null;
};

export function getAssetPath(subfolder: string, filename: string) {
  const clean = subfolder.endsWith("/") ? subfolder.slice(0, -1) : subfolder;
  if (!clean || clean.trim() === "") return `/assets/${filename}`;
  return `/assets/${clean}/${filename}`;
}
