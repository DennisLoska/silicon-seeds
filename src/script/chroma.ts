import { join } from "node:path";

const libraryDir = Bun.env.CONTENT_LIBRARY_DIR ?? join(process.cwd(), "content_library");
const dataPath = join(libraryDir, "chroma-data");
const port = Bun.env.CHROMADB_PORT ?? "8000";
const host = Bun.env.CHROMADB_HOST ?? "127.0.0.1";

const proc = Bun.spawn(
  ["bunx", "chroma", "run", "--path", dataPath, "--host", host, "--port", port],
  { stdio: ["inherit", "inherit", "inherit"] },
);
await proc.exited;
